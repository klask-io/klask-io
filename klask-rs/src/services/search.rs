use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tantivy::collector::{Count, TopDocs};
use tantivy::query::{QueryParser, BooleanQuery, TermQuery};
use tantivy::schema::{Schema, Field, FAST, STORED, TEXT, Value};
use tantivy::snippet::SnippetGenerator;
use tantivy::{doc, Index, IndexReader, IndexWriter, Term};
use tokio::sync::RwLock;
use uuid::Uuid;

use tracing::{debug, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub file_id: Uuid,
    pub doc_address: String, // Format: "segment_ord:doc_id"
    pub file_name: String,
    pub file_path: String,
    pub content_snippet: String,
    pub project: String,
    pub version: String,
    pub extension: String,
    pub score: f32,
    pub line_number: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResultsWithTotal {
    pub results: Vec<SearchResult>,
    pub total: u64,
    pub facets: Option<SearchFacets>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFacets {
    pub projects: HashMap<String, u64>,
    pub versions: HashMap<String, u64>,
    pub extensions: HashMap<String, u64>,
}

#[derive(Debug, Clone)]
pub struct SearchQuery {
    pub query: String,
    pub project_filter: Option<String>,
    pub version_filter: Option<String>,
    pub extension_filter: Option<String>,
    pub limit: usize,
    pub offset: usize,
    pub include_facets: bool,
}

pub struct SearchService {
    index: Index,
    reader: IndexReader,
    writer: Arc<RwLock<IndexWriter>>,
    schema: Schema,
    fields: SearchFields,
    index_dir: std::path::PathBuf,
}

#[derive(Clone)]
struct SearchFields {
    file_id: Field,
    file_name: Field,
    file_path: Field,
    content: Field,
    project: Field,
    version: Field,
    extension: Field,
}

impl SearchService {
    pub fn new<P: AsRef<Path>>(index_dir: P) -> Result<Self> {
        let schema = Self::build_schema();
        let fields = Self::extract_fields(&schema);
        
        let index = if index_dir.as_ref().exists() {
            Index::open_in_dir(&index_dir)?
        } else {
            std::fs::create_dir_all(&index_dir)?;
            Index::create_in_dir(&index_dir, schema.clone())?
        };

        let reader = index.reader()?;

        let writer = Arc::new(RwLock::new(index.writer(50_000_000)?)); // 50MB heap

        Ok(Self {
            index,
            reader,
            writer,
            schema,
            fields,
            index_dir: index_dir.as_ref().to_path_buf(),
        })
    }

    fn build_schema() -> Schema {
        let mut schema_builder = Schema::builder();
        
        // File metadata fields  
        schema_builder.add_text_field("file_id", TEXT | STORED | FAST);
        schema_builder.add_text_field("file_name", TEXT | STORED);
        schema_builder.add_text_field("file_path", TEXT | STORED);
        
        // Content field with custom analyzer for code search
        schema_builder.add_text_field("content", TEXT | STORED);
        
        // Filter fields
        schema_builder.add_text_field("project", TEXT | STORED | FAST);
        schema_builder.add_text_field("version", TEXT | STORED | FAST);
        schema_builder.add_text_field("extension", TEXT | STORED | FAST);
        
        schema_builder.build()
    }

    fn extract_fields(schema: &Schema) -> SearchFields {
        SearchFields {
            file_id: schema.get_field("file_id").expect("file_id field should exist"),
            file_name: schema.get_field("file_name").expect("file_name field should exist"),
            file_path: schema.get_field("file_path").expect("file_path field should exist"),
            content: schema.get_field("content").expect("content field should exist"),
            project: schema.get_field("project").expect("project field should exist"),
            version: schema.get_field("version").expect("version field should exist"),
            extension: schema.get_field("extension").expect("extension field should exist"),
        }
    }

    pub async fn index_file(
        &self,
        file_id: Uuid,
        file_name: &str,
        file_path: &str,
        content: &str,
        project: &str,
        version: &str,
        extension: &str,
    ) -> Result<()> {
        let writer = self.writer.write().await;
        
        let doc = doc!(
            self.fields.file_id => file_id.to_string(),
            self.fields.file_name => file_name,
            self.fields.file_path => file_path,
            self.fields.content => content,
            self.fields.project => project,
            self.fields.version => version,
            self.fields.extension => extension,
        );

        writer.add_document(doc)?;
        Ok(())
    }

    /// Upsert a file - delete existing and add new version if it exists, otherwise just add
    pub async fn upsert_file(
        &self,
        file_id: Uuid,
        file_name: &str,
        file_path: &str,
        content: &str,
        project: &str,
        version: &str,
        extension: &str,
    ) -> Result<()> {
        let writer = self.writer.write().await;
        
        // Delete existing document with the same file_id
        let term = tantivy::Term::from_field_text(self.fields.file_id, &file_id.to_string());
        writer.delete_term(term);
        
        // Add the new document
        let doc = doc!(
            self.fields.file_id => file_id.to_string(),
            self.fields.file_name => file_name,
            self.fields.file_path => file_path,
            self.fields.content => content,
            self.fields.project => project,
            self.fields.version => version,
            self.fields.extension => extension,
        );

        writer.add_document(doc)?;
        Ok(())
    }

    /// Check if a document exists by file_id (lightweight check)
    pub async fn document_exists(&self, file_id: Uuid) -> Result<bool> {
        // Use the existing get_file_by_id method but only check if result is Some
        let result = self.get_file_by_id(file_id).await?;
        Ok(result.is_some())
    }

    pub async fn commit(&self) -> Result<()> {
        let mut writer = self.writer.write().await;
        writer.commit()?;
        Ok(())
    }

    /// Reset the entire search index (delete all documents)
    pub async fn reset_index(&self) -> Result<()> {
        // Delete the index directory and recreate it
        if self.index_dir.exists() {
            std::fs::remove_dir_all(&self.index_dir)?;
        }
        std::fs::create_dir_all(&self.index_dir)?;
        
        // Recreate the index
        let _new_index = Index::create_in_dir(&self.index_dir, self.schema.clone())?;
        
        // Note: We can't replace self.index directly since it's not mutable
        // Instead, we'll delete all documents from the existing index
        let mut writer = self.writer.write().await;
        writer.delete_all_documents()?;
        writer.commit()?;
        
        // Reload the reader to see the changes
        self.reader.reload()?;
        
        Ok(())
    }

    pub async fn search(&self, search_query: SearchQuery) -> Result<SearchResultsWithTotal> {
        let searcher = self.reader.searcher();
        
        // Build query parser for content search
        let query_parser = QueryParser::for_index(&self.index, vec![
            self.fields.content,
            self.fields.file_name,
            self.fields.file_path,
        ]);

        // Parse the main query
        let base_query = query_parser.parse_query(&search_query.query)
            .map_err(|e| anyhow!("Failed to parse query '{}': {}", search_query.query, e))?;
        
        // Create snippet generator once for the entire search
        let snippet_generator = if search_query.limit > 0 {
            Some(self.create_snippet_generator(&searcher, &*base_query)?)
        } else {
            None
        };

        // Build filter queries if filters are provided
        let mut filter_queries = Vec::new();
        
        if let Some(project_filter) = &search_query.project_filter {
            let term = Term::from_field_text(self.fields.project, project_filter);
            filter_queries.push(Box::new(TermQuery::new(term, tantivy::schema::IndexRecordOption::Basic)) as Box<dyn tantivy::query::Query>);
        }
        
        if let Some(version_filter) = &search_query.version_filter {
            let term = Term::from_field_text(self.fields.version, version_filter);
            filter_queries.push(Box::new(TermQuery::new(term, tantivy::schema::IndexRecordOption::Basic)) as Box<dyn tantivy::query::Query>);
        }
        
        if let Some(extension_filter) = &search_query.extension_filter {
            let term = Term::from_field_text(self.fields.extension, extension_filter);
            filter_queries.push(Box::new(TermQuery::new(term, tantivy::schema::IndexRecordOption::Basic)) as Box<dyn tantivy::query::Query>);
        }

        // Combine base query with filters using BooleanQuery if we have filters
        let final_query: Box<dyn tantivy::query::Query> = if !filter_queries.is_empty() {
            let mut clauses = vec![(tantivy::query::Occur::Must, base_query)];
            for filter in filter_queries {
                clauses.push((tantivy::query::Occur::Must, filter));
            }
            Box::new(BooleanQuery::new(clauses))
        } else {
            base_query
        };

        // For performance with large indices, use Count collector for total
        let total = searcher.search(&final_query, &Count)? as u64;

        // Ensure limit is at least 1 to avoid Tantivy panic
        let effective_limit = if search_query.limit == 0 { 1 } else { search_query.limit };
        
        // Execute search with pagination
        let top_docs = searcher.search(
            &final_query, 
            &TopDocs::with_limit(effective_limit).and_offset(search_query.offset)
        )?;

        let mut results = Vec::new();
        
        // Only process results if limit > 0 (for facets-only searches, we don't need results)
        if search_query.limit > 0 {
            for (score, doc_address) in top_docs {
                let retrieved_doc = searcher.doc::<tantivy::TantivyDocument>(doc_address)?;
                
                let file_id_str = retrieved_doc
                    .get_first(self.fields.file_id)
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| anyhow!("Missing file_id in search result"))?;
                
                let file_id = Uuid::parse_str(file_id_str)
                    .map_err(|_| anyhow!("Invalid UUID format in file_id: {}", file_id_str))?;

                let file_name = retrieved_doc
                    .get_first(self.fields.file_name)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let file_path = retrieved_doc
                    .get_first(self.fields.file_path)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let project = retrieved_doc
                    .get_first(self.fields.project)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let version = retrieved_doc
                    .get_first(self.fields.version)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let extension = retrieved_doc
                    .get_first(self.fields.extension)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                // No need for post-query filtering anymore since we're using query-time filters

                // Generate content snippet and extract line number
                let (content_snippet, line_number) = if let Some(ref generator) = snippet_generator {
                    self.generate_optimized_snippet(generator, &search_query.query, &retrieved_doc)?
                } else {
                    ("".to_string(), None)
                };

                // Format DocAddress as "segment_ord:doc_id"
                let doc_address_str = format!("{}:{}", doc_address.segment_ord, doc_address.doc_id);

                results.push(SearchResult {
                    file_id,
                    doc_address: doc_address_str,
                    file_name,
                    file_path,
                    content_snippet,
                    project,
                    version,
                    extension,
                    score,
                    line_number,
                });
            }
        }

        // Collect facets on search results (not entire index) for performance
        let facets = if search_query.include_facets 
            && search_query.project_filter.is_none() 
            && search_query.version_filter.is_none() 
            && search_query.extension_filter.is_none() {
            Some(self.collect_facets_from_results(&searcher, &final_query).await?)
        } else {
            None
        };

        Ok(SearchResultsWithTotal {
            results,
            total,
            facets,
        })
    }

    fn generate_snippet(&self, query: &str, doc: &tantivy::TantivyDocument) -> Result<String> {
        // Simple snippet generation - in production, use Tantivy's snippet generator
        if let Some(content) = doc.get_first(self.fields.content).and_then(|v| v.as_str()) {
            // Find the first occurrence of any query term
            let query_terms: Vec<&str> = query.split_whitespace().collect();
            
            for term in query_terms {
                if let Some(pos) = content.to_lowercase().find(&term.to_lowercase()) {
                    let start = pos.saturating_sub(100);
                    let end = (pos + term.len() + 100).min(content.len());
                    return Ok(content[start..end].to_string());
                }
            }
            
            // Fallback: return first 200 characters
            if content.len() > 200 {
                Ok(format!("{}...", &content[..200]))
            } else {
                Ok(content.to_string())
            }
        } else {
            Ok("No content available".to_string())
        }
    }

    fn create_snippet_generator(&self, searcher: &tantivy::Searcher, query: &dyn tantivy::query::Query) -> Result<SnippetGenerator> {
        let mut snippet_generator = SnippetGenerator::create(searcher, query, self.fields.content)?;
        snippet_generator.set_max_num_chars(200);
        Ok(snippet_generator)
    }

    fn generate_optimized_snippet(&self, generator: &SnippetGenerator, query: &str, doc: &tantivy::TantivyDocument) -> Result<(String, Option<u32>)> {
        // Generate the snippet with HTML highlighting - this is now much faster
        let snippet = generator.snippet_from_doc(doc);
        let highlighted_html = snippet.to_html();
        
        // For line number, use a simple approach to avoid scanning the entire content
        let line_number = if let Some(content) = doc.get_first(self.fields.content).and_then(|v| v.as_str()) {
            // Only search for the first term to avoid performance issues
            if let Some(first_term) = query.split_whitespace().next() {
                if let Some(pos) = content.to_lowercase().find(&first_term.to_lowercase()) {
                    Some(content[..pos].chars().filter(|&c| c == '\n').count() as u32 + 1)
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };
        
        Ok((highlighted_html, line_number))
    }

    fn generate_snippet_with_line_number(&self, query: &str, doc: &tantivy::TantivyDocument) -> Result<(String, Option<u32>)> {
        // Parse the query to get the actual Tantivy query object
        let query_parser = QueryParser::for_index(&self.index, vec![
            self.fields.content,
            self.fields.file_name,
            self.fields.file_path,
        ]);
        
        let parsed_query = query_parser.parse_query(query)
            .map_err(|e| anyhow!("Failed to parse query for snippet: {}", e))?;
        
        // Create snippet generator with 150 character fragment size
        let mut snippet_generator = SnippetGenerator::create(&self.reader.searcher(), &*parsed_query, self.fields.content)?;
        snippet_generator.set_max_num_chars(200);
        
        // Generate the snippet with HTML highlighting
        let snippet = snippet_generator.snippet_from_doc(doc);
        let highlighted_html = snippet.to_html();
        
        // Extract line number if we have content
        let line_number = if let Some(content) = doc.get_first(self.fields.content).and_then(|v| v.as_str()) {
            // Find the first highlighted term position to calculate line number
            let query_terms: Vec<&str> = query.split_whitespace().collect();
            let mut first_match_line = None;
            
            for term in query_terms {
                if let Some(pos) = content.to_lowercase().find(&term.to_lowercase()) {
                    let line_num = content[..pos].chars().filter(|&c| c == '\n').count() as u32 + 1;
                    if first_match_line.is_none() || line_num < first_match_line.unwrap() {
                        first_match_line = Some(line_num);
                    }
                }
            }
            first_match_line
        } else {
            None
        };
        
        Ok((highlighted_html, line_number))
    }

    pub async fn delete_file(&self, file_id: Uuid) -> Result<()> {
        let writer = self.writer.write().await;
        let term = tantivy::Term::from_field_text(self.fields.file_id, &file_id.to_string());
        writer.delete_term(term);
        Ok(())
    }

    pub async fn clear_index(&self) -> Result<()> {
        let mut writer = self.writer.write().await;
        writer.delete_all_documents()?;
        writer.commit()?;
        Ok(())
    }

    pub fn get_stats(&self) -> Result<SearchStats> {
        let searcher = self.reader.searcher();
        let num_docs = searcher.num_docs() as u64;
        
        Ok(SearchStats {
            total_documents: num_docs,
            index_size_bytes: 0, // TODO: Calculate actual index size
        })
    }

    pub async fn get_file_by_doc_address(&self, doc_address_str: &str) -> Result<Option<SearchResult>> {
        // Parse "segment_ord:doc_id" format
        let parts: Vec<&str> = doc_address_str.split(':').collect();
        if parts.len() != 2 {
            return Err(anyhow!("Invalid doc_address format, expected 'segment_ord:doc_id'"));
        }
        
        let segment_ord: u32 = parts[0].parse()
            .map_err(|_| anyhow!("Invalid segment_ord in doc_address: {}", parts[0]))?;
        let doc_id: u32 = parts[1].parse()
            .map_err(|_| anyhow!("Invalid doc_id in doc_address: {}", parts[1]))?;
            
        let doc_address = tantivy::DocAddress::new(segment_ord, doc_id);
        let searcher = self.reader.searcher();
        
        // Try to get the document directly using DocAddress
        match searcher.doc::<tantivy::TantivyDocument>(doc_address) {
            Ok(retrieved_doc) => {
                let file_id_str = retrieved_doc
                    .get_first(self.fields.file_id)
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| anyhow!("Missing file_id in document"))?;
                
                let file_id = Uuid::parse_str(file_id_str)
                    .map_err(|_| anyhow!("Invalid UUID format in file_id: {}", file_id_str))?;

                let file_name = retrieved_doc
                    .get_first(self.fields.file_name)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let file_path = retrieved_doc
                    .get_first(self.fields.file_path)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let content = retrieved_doc
                    .get_first(self.fields.content)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let project = retrieved_doc
                    .get_first(self.fields.project)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let version = retrieved_doc
                    .get_first(self.fields.version)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                let extension = retrieved_doc
                    .get_first(self.fields.extension)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                
                Ok(Some(SearchResult {
                    file_id,
                    doc_address: doc_address_str.to_string(),
                    file_name,
                    file_path,
                    content_snippet: content,
                    project,
                    version,
                    extension,
                    score: 1.0,
                    line_number: None,
                }))
            }
            Err(_) => {
                // Document not found at this address
                Ok(None)
            }
        }
    }

    pub async fn get_file_by_id(&self, file_id: Uuid) -> Result<Option<SearchResult>> {
        // Reload the reader to see the latest changes
        self.reader.reload()?;
        let searcher = self.reader.searcher();
        debug!("Getting file by id: {}", file_id);
        
        // Get all documents and search for matching file_id
        let all_docs_query = tantivy::query::AllQuery;
        let top_docs = searcher.search(&all_docs_query, &TopDocs::with_limit(10000))?;
        debug!("Found {} total documents", top_docs.len());
        
        for (score, doc_address) in top_docs {
            let retrieved_doc = searcher.doc::<tantivy::TantivyDocument>(doc_address)?;
            
            // Check if this document has the matching file_id
            if let Some(doc_file_id_str) = retrieved_doc
                .get_first(self.fields.file_id)
                .and_then(|v| v.as_str()) {
                
                if let Ok(doc_file_id) = Uuid::parse_str(doc_file_id_str) {
                    if doc_file_id == file_id {
                        debug!("Found matching document for file_id: {}", file_id);
                        
                        let file_name = retrieved_doc
                            .get_first(self.fields.file_name)
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();

                        let file_path = retrieved_doc
                            .get_first(self.fields.file_path)
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();

                        let content = retrieved_doc
                            .get_first(self.fields.content)
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();

                        let project = retrieved_doc
                            .get_first(self.fields.project)
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();

                        let version = retrieved_doc
                            .get_first(self.fields.version)
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();

                        let extension = retrieved_doc
                            .get_first(self.fields.extension)
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        
                        // Format DocAddress as "segment_ord:doc_id"
                        let doc_address_str = format!("{}:{}", doc_address.segment_ord, doc_address.doc_id);
                        
                        return Ok(Some(SearchResult {
                            file_id,
                            doc_address: doc_address_str,
                            file_name,
                            file_path,
                            content_snippet: content, // Return full content instead of snippet
                            project,
                            version,
                            extension,
                            score,
                            line_number: None,
                        }));
                    }
                }
            }
        }
        
        // If no matching document found
        debug!("No document found with file_id: {}", file_id);
        Ok(None)
    }

    pub fn get_document_count(&self) -> Result<u64> {
        // Reload the reader to see the latest changes
        self.reader.reload()?;
        let searcher = self.reader.searcher();
        Ok(searcher.num_docs() as u64)
    }

    /// Calculate the total size of a directory recursively in bytes
    fn calculate_directory_size(dir_path: &Path) -> Result<u64> {
        let mut total_size = 0u64;
        
        if !dir_path.exists() {
            debug!("Directory does not exist: {:?}", dir_path);
            return Ok(0);
        }
        
        if !dir_path.is_dir() {
            debug!("Path is not a directory: {:?}", dir_path);
            return Ok(0);
        }
        
        let read_dir = std::fs::read_dir(dir_path)
            .map_err(|e| anyhow!("Failed to read directory {:?}: {}", dir_path, e))?;
        
        for entry_result in read_dir {
            let entry = entry_result
                .map_err(|e| anyhow!("Failed to read directory entry in {:?}: {}", dir_path, e))?;
            
            let path = entry.path();
            let metadata = entry.metadata()
                .map_err(|e| anyhow!("Failed to get metadata for {:?}: {}", path, e))?;
            
            if metadata.is_file() {
                total_size = total_size.saturating_add(metadata.len());
            } else if metadata.is_dir() {
                // Recursively calculate subdirectory size
                let subdir_size = Self::calculate_directory_size(&path)?;
                total_size = total_size.saturating_add(subdir_size);
            }
        }
        
        Ok(total_size)
    }

    /// Get the search index size in megabytes
    pub fn get_index_size_mb(&self) -> f64 {
        match Self::calculate_directory_size(&self.index_dir) {
            Ok(size_bytes) => {
                let size_mb = size_bytes as f64 / 1_048_576.0; // Convert bytes to MB
                debug!("Index directory size: {} bytes ({:.2} MB)", size_bytes, size_mb);
                size_mb
            }
            Err(e) => {
                warn!("Failed to calculate index size for {:?}: {}", self.index_dir, e);
                0.0
            }
        }
    }

    /// Collect facets from the search index for filtering
    async fn collect_facets_from_results(&self, searcher: &tantivy::Searcher, query: &dyn tantivy::query::Query) -> Result<SearchFacets> {
        // Get up to 10k results for facet calculation (much faster than entire index)
        const FACET_CALCULATION_LIMIT: usize = 10000;
        let top_docs = searcher.search(query, &TopDocs::with_limit(FACET_CALCULATION_LIMIT))?;
        
        let mut project_counts: HashMap<String, u64> = HashMap::new();
        let mut version_counts: HashMap<String, u64> = HashMap::new();
        let mut extension_counts: HashMap<String, u64> = HashMap::new();
        
        // Count facets only from the search results
        for (_score, doc_address) in top_docs {
            let doc = searcher.doc::<tantivy::TantivyDocument>(doc_address)?;
            
            // Count project facets
            if let Some(project) = doc.get_first(self.fields.project).and_then(|v| v.as_str()) {
                if !project.is_empty() {
                    *project_counts.entry(project.to_string()).or_insert(0) += 1;
                }
            }
            
            // Count version facets  
            if let Some(version) = doc.get_first(self.fields.version).and_then(|v| v.as_str()) {
                if !version.is_empty() {
                    *version_counts.entry(version.to_string()).or_insert(0) += 1;
                }
            }
            
            // Count extension facets
            if let Some(extension) = doc.get_first(self.fields.extension).and_then(|v| v.as_str()) {
                if !extension.is_empty() {
                    *extension_counts.entry(extension.to_string()).or_insert(0) += 1;
                }
            }
        }
        
        // Sort and limit to top 50 each for UI performance
        let mut projects: Vec<(String, u64)> = project_counts.into_iter().collect();
        projects.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
        projects.truncate(50);
        let projects_map: HashMap<String, u64> = projects.into_iter().collect();
        
        let mut versions: Vec<(String, u64)> = version_counts.into_iter().collect();
        versions.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
        versions.truncate(50);
        let versions_map: HashMap<String, u64> = versions.into_iter().collect();
        
        let mut extensions: Vec<(String, u64)> = extension_counts.into_iter().collect();
        extensions.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
        extensions.truncate(50);
        let extensions_map: HashMap<String, u64> = extensions.into_iter().collect();
        
        Ok(SearchFacets {
            projects: projects_map,
            versions: versions_map,
            extensions: extensions_map,
        })
    }

    async fn collect_facets(&self, query: &str) -> Result<SearchFacets> {
        let searcher = self.reader.searcher();
        
        // Build query parser for content search
        let query_parser = QueryParser::for_index(&self.index, vec![
            self.fields.content,
            self.fields.file_name,
            self.fields.file_path,
        ]);

        // Parse the query to get matching documents
        let parsed_query = query_parser.parse_query(query)
            .map_err(|e| anyhow!("Failed to parse query '{}': {}", query, e))?;
        
        // Get matching documents (up to 10000 for facet collection)
        let top_docs = searcher.search(&parsed_query, &TopDocs::with_limit(10000))?;
        
        let mut projects = HashMap::new();
        let mut versions = HashMap::new();
        let mut extensions = HashMap::new();
        
        // Collect facet values from matching documents
        for (_score, doc_address) in top_docs {
            let retrieved_doc = searcher.doc::<tantivy::TantivyDocument>(doc_address)?;
            
            if let Some(project) = retrieved_doc
                .get_first(self.fields.project)
                .and_then(|v| v.as_str()) {
                if !project.is_empty() {
                    *projects.entry(project.to_string()).or_insert(0) += 1;
                }
            }
            
            if let Some(version) = retrieved_doc
                .get_first(self.fields.version)
                .and_then(|v| v.as_str()) {
                if !version.is_empty() {
                    *versions.entry(version.to_string()).or_insert(0) += 1;
                }
            }
            
            if let Some(extension) = retrieved_doc
                .get_first(self.fields.extension)
                .and_then(|v| v.as_str()) {
                if !extension.is_empty() {
                    *extensions.entry(extension.to_string()).or_insert(0) += 1;
                }
            }
        }
        
        Ok(SearchFacets {
            projects,
            versions,
            extensions,
        })
    }
}

#[derive(Debug, Serialize)]
pub struct SearchStats {
    pub total_documents: u64,
    pub index_size_bytes: u64,
}
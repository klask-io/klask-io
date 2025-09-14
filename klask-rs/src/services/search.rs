use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::{Schema, Field, FAST, STORED, TEXT, Value};
use tantivy::snippet::{Snippet, SnippetGenerator};
use tantivy::{doc, DocAddress, Index, IndexReader, IndexWriter};
use tokio::sync::RwLock;
use uuid::Uuid;

use tracing::{debug, error, info, warn};

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
}

#[derive(Debug, Clone)]
pub struct SearchQuery {
    pub query: String,
    pub project_filter: Option<String>,
    pub version_filter: Option<String>,
    pub extension_filter: Option<String>,
    pub limit: usize,
    pub offset: usize,
}

pub struct SearchService {
    index: Index,
    reader: IndexReader,
    writer: Arc<RwLock<IndexWriter>>,
    schema: Schema,
    fields: SearchFields,
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

    pub async fn commit(&self) -> Result<()> {
        let mut writer = self.writer.write().await;
        writer.commit()?;
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
        let query = query_parser.parse_query(&search_query.query)
            .map_err(|e| anyhow!("Failed to parse query '{}': {}", search_query.query, e))?;

        // First, get total count without limit/offset
        let total_count = searcher.search(&query, &TopDocs::with_limit(1000000))?;
        let total = total_count.len() as u64;

        // Execute search with pagination
        let top_docs = searcher.search(
            &query, 
            &TopDocs::with_limit(search_query.limit).and_offset(search_query.offset)
        )?;

        let mut results = Vec::new();
        
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

            // Apply filters
            if let Some(project_filter) = &search_query.project_filter {
                if project != *project_filter {
                    continue;
                }
            }
            
            if let Some(version_filter) = &search_query.version_filter {
                if version != *version_filter {
                    continue;
                }
            }
            
            if let Some(extension_filter) = &search_query.extension_filter {
                if extension != *extension_filter {
                    continue;
                }
            }

            // Generate content snippet and extract line number
            let (content_snippet, line_number) = self.generate_snippet_with_line_number(&search_query.query, &retrieved_doc)?;

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

        Ok(SearchResultsWithTotal {
            results,
            total,
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
        let searcher = self.reader.searcher();
        Ok(searcher.num_docs() as u64)
    }
}

#[derive(Debug, Serialize)]
pub struct SearchStats {
    pub total_documents: u64,
    pub index_size_bytes: u64,
}
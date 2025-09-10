use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::{Schema, Field, FAST, STORED, TEXT, Value};
use tantivy::{doc, Index, IndexReader, IndexWriter};
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub file_id: Uuid,
    pub file_name: String,
    pub file_path: String,
    pub content_snippet: String,
    pub project: String,
    pub version: String,
    pub extension: String,
    pub score: f32,
    pub line_number: Option<u32>,
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
        schema_builder.add_text_field("file_id", STORED | FAST);
        schema_builder.add_text_field("file_name", TEXT | STORED);
        schema_builder.add_text_field("file_path", TEXT | STORED);
        
        // Content field with custom analyzer for code search
        schema_builder.add_text_field("content", TEXT);
        
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

    pub async fn search(&self, search_query: SearchQuery) -> Result<Vec<SearchResult>> {
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

        // Execute search
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

            // Generate content snippet (simplified version)
            let content_snippet = self.generate_snippet(&search_query.query, &retrieved_doc)?;

            results.push(SearchResult {
                file_id,
                file_name,
                file_path,
                content_snippet,
                project,
                version,
                extension,
                score,
                line_number: None, // TODO: Implement line number extraction
            });
        }

        Ok(results)
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
}

#[derive(Debug, Serialize)]
pub struct SearchStats {
    pub total_documents: u64,
    pub index_size_bytes: u64,
}
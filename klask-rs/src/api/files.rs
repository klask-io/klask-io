use anyhow::Result;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::auth::extractors::AppState;
use crate::repositories::FileRepository;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileResponse {
    pub id: Uuid,
    pub name: String,
    pub path: String,
    pub content: Option<String>,
    pub project: String,
    pub version: String,
    pub extension: String,
    pub size: i64,
}

#[derive(Debug, Deserialize)]
pub struct FileQueryParams {
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub project: Option<String>,
    pub version: Option<String>,
    pub extension: Option<String>,
}

pub async fn create_router() -> Result<Router<AppState>> {
    let router = Router::new()
        .route("/", get(list_files))
        .route("/:id", get(get_file))
        .route("/doc/:doc_address", get(get_file_by_doc_address));

    Ok(router)
}

async fn list_files(
    State(app_state): State<AppState>,
    Query(params): Query<FileQueryParams>,
) -> Result<Json<Vec<FileResponse>>, StatusCode> {
    let page = params.page.unwrap_or(1);
    let limit = params.limit.unwrap_or(50);
    let offset = (page - 1) * limit;
    
    let file_repo = FileRepository::new(app_state.database.pool().clone());
    
    match file_repo.list_files(Some(limit), Some(offset)).await {
        Ok(files) => {
            let responses: Vec<FileResponse> = files
                .into_iter()
                .map(|f| FileResponse {
                    id: f.id,
                    name: f.name,
                    path: f.path,
                    content: f.content,
                    project: f.project,
                    version: f.version,
                    extension: f.extension,
                    size: f.size,
                })
                .collect();
            Ok(Json(responses))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_file(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<FileResponse>, StatusCode> {
    tracing::debug!("Getting file by id: {}", id);
    
    // Try to get file from Tantivy search index first
    match app_state.search_service.get_file_by_id(id).await {
        Ok(Some(search_result)) => {
            tracing::debug!("Found file in search index: {} (content size: {})", 
                search_result.file_name, search_result.content_snippet.len());
            
            let content_size = search_result.content_snippet.len() as i64;
            Ok(Json(FileResponse {
                id,
                name: search_result.file_name,
                path: search_result.file_path,
                content: Some(search_result.content_snippet), // This is the full content from Tantivy
                project: search_result.project,
                version: search_result.version,
                extension: search_result.extension,
                size: content_size,
            }))
        }
        Ok(None) => {
            tracing::debug!("File not found in search index, trying database");
            // Fallback to database if not found in Tantivy
            let file_repo = FileRepository::new(app_state.database.pool().clone());
            match file_repo.get_file(id).await {
                Ok(Some(file)) => {
                    tracing::debug!("Found file in database: {}", file.name);
                    Ok(Json(FileResponse {
                        id: file.id,
                        name: file.name,
                        path: file.path,
                        content: file.content,
                        project: file.project,
                        version: file.version,
                        extension: file.extension,
                        size: file.size,
                    }))
                },
                Ok(None) => {
                    tracing::debug!("File not found in database either");
                    Err(StatusCode::NOT_FOUND)
                },
                Err(e) => {
                    tracing::error!("Database error when fetching file: {}", e);
                    Err(StatusCode::INTERNAL_SERVER_ERROR)
                },
            }
        }
        Err(e) => {
            tracing::error!("Search service error when fetching file: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

async fn get_file_by_doc_address(
    State(app_state): State<AppState>,
    Path(doc_address): Path<String>,
) -> Result<Json<FileResponse>, StatusCode> {
    tracing::debug!("Getting file by doc_address: {}", doc_address);
    
    // Get file directly from Tantivy using DocAddress
    match app_state.search_service.get_file_by_doc_address(&doc_address).await {
        Ok(Some(search_result)) => {
            tracing::debug!("Found file at doc_address: {} (content size: {})", 
                doc_address, search_result.content_snippet.len());
            
            let content_size = search_result.content_snippet.len() as i64;
            Ok(Json(FileResponse {
                id: search_result.file_id,
                name: search_result.file_name,
                path: search_result.file_path,
                content: Some(search_result.content_snippet), // This is the full content from Tantivy
                project: search_result.project,
                version: search_result.version,
                extension: search_result.extension,
                size: content_size,
            }))
        }
        Ok(None) => {
            tracing::debug!("File not found at doc_address: {}", doc_address);
            Err(StatusCode::NOT_FOUND)
        }
        Err(e) => {
            tracing::error!("Search service error when fetching file by doc_address: {}", e);
            Err(StatusCode::BAD_REQUEST)
        },
    }
}
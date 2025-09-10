use anyhow::Result;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use tracing;
use crate::auth::extractors::AppState;
use crate::services::SearchQuery;

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchRequest {
    pub query: String,
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub project: Option<String>,
    pub version: Option<String>,
    pub extension: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    pub total: u64,
    pub page: u32,
    pub limit: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub name: String,
    pub path: String,
    pub content_snippet: String,
    pub project: String,
    pub version: String,
    pub extension: String,
    pub score: f32,
}

pub async fn create_router() -> Result<Router<AppState>> {
    let router = Router::new()
        .route("/", get(search_files));

    Ok(router)
}

async fn search_files(
    State(app_state): State<AppState>,
    Query(params): Query<SearchRequest>,
) -> Result<Json<SearchResponse>, StatusCode> {
    let page = params.page.unwrap_or(1);
    let limit = params.limit.unwrap_or(50);
    let offset = (page - 1) * limit;
    
    // Build search query
    let search_query = SearchQuery {
        query: params.query,
        project_filter: params.project,
        version_filter: params.version,
        extension_filter: params.extension,
        limit: limit as usize,
        offset: offset as usize,
    };
    
    // Perform search using Tantivy
    match app_state.search_service.search(search_query).await {
        Ok(search_results) => {
            let results: Vec<SearchResult> = search_results
                .into_iter()
                .map(|r| SearchResult {
                    id: r.file_id.to_string(),
                    name: r.file_name,
                    path: r.file_path,
                    content_snippet: r.content_snippet,
                    project: r.project,
                    version: r.version,
                    extension: r.extension,
                    score: r.score,
                })
                .collect();
            
            let response = SearchResponse {
                total: results.len() as u64, // TODO: Get actual total count
                results,
                page,
                limit,
            };
            
            Ok(Json(response))
        }
        Err(e) => {
            tracing::error!("Search failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
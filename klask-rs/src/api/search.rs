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
    pub q: Option<String>,
    pub query: Option<String>,
    #[serde(alias = "max_results")]
    pub limit: Option<u32>,
    pub page: Option<u32>,
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
    pub file_id: String,
    pub doc_address: String,
    pub name: String,
    pub path: String,
    pub content_snippet: String,
    pub project: String,
    pub version: String,
    pub extension: String,
    pub score: f32,
    pub line_number: Option<u32>,
}

pub async fn create_router() -> Result<Router<AppState>> {
    let router = Router::new()
        .route("/", get(search_files))
        .route("/filters", get(get_search_filters));

    Ok(router)
}

async fn search_files(
    State(app_state): State<AppState>,
    Query(params): Query<SearchRequest>,
) -> Result<Json<SearchResponse>, StatusCode> {
    let page = params.page.unwrap_or(1);
    let limit = params.limit.unwrap_or(50);
    let offset = (page - 1) * limit;
    
    // Get search query from either 'q' or 'query' parameter
    let query_string = params.q.or(params.query)
        .ok_or(StatusCode::BAD_REQUEST)?;
    
    // Build search query
    let search_query = SearchQuery {
        query: query_string,
        project_filter: params.project,
        version_filter: params.version,
        extension_filter: params.extension,
        limit: limit as usize,
        offset: offset as usize,
    };
    
    // Perform search using Tantivy
    match app_state.search_service.search(search_query).await {
        Ok(search_response) => {
            let results: Vec<SearchResult> = search_response.results
                .into_iter()
                .map(|r| SearchResult {
                    id: r.file_id.to_string(),
                    file_id: r.file_id.to_string(),
                    doc_address: r.doc_address,
                    name: r.file_name,
                    path: r.file_path,
                    content_snippet: r.content_snippet,
                    project: r.project,
                    version: r.version,
                    extension: r.extension,
                    score: r.score,
                    line_number: r.line_number,
                })
                .collect();
            
            let response = SearchResponse {
                total: search_response.total,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchFilters {
    pub projects: Vec<String>,
    pub versions: Vec<String>,
    pub extensions: Vec<String>,
}

async fn get_search_filters(
    _state: State<AppState>,
) -> Result<Json<SearchFilters>, StatusCode> {
    // For now, return static filters based on typical usage
    // In a real implementation, this would query the search index or database
    // to get actual available filters from indexed files
    let filters = SearchFilters {
        projects: vec![
            "test".to_string(),
        ],
        versions: vec![
            "HEAD".to_string(),
        ],
        extensions: vec![
            "rs".to_string(),
            "py".to_string(),
            "js".to_string(),
            "ts".to_string(),
            "md".to_string(),
            "txt".to_string(),
            "json".to_string(),
            "toml".to_string(),
            "yaml".to_string(),
            "yml".to_string(),
        ],
    };
    
    Ok(Json(filters))
}
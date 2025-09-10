use anyhow::Result;
use axum::{
    extract::Query,
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};

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
    pub size: i64,
    pub score: f32,
}

pub async fn create_router() -> Result<Router> {
    let router = Router::new().route("/", get(search_files));

    Ok(router)
}

async fn search_files(
    Query(params): Query<SearchRequest>,
) -> Result<Json<SearchResponse>, StatusCode> {
    // TODO: Implement actual search using Tantivy
    let _query = params.query;
    let page = params.page.unwrap_or(1);
    let limit = params.limit.unwrap_or(50);
    
    // Return empty results for now
    let response = SearchResponse {
        results: vec![],
        total: 0,
        page,
        limit,
    };
    
    Ok(Json(response))
}
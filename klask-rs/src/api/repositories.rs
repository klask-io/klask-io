use anyhow::Result;
use axum::{
    extract::Path,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Repository {
    pub id: Uuid,
    pub name: String,
    pub url: String,
    pub repository_type: RepositoryType,
    pub branch: Option<String>,
    pub enabled: bool,
    pub last_crawled: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum RepositoryType {
    Git,
    GitLab,
    FileSystem,
}

#[derive(Debug, Deserialize)]
pub struct CreateRepositoryRequest {
    pub name: String,
    pub url: String,
    pub repository_type: RepositoryType,
    pub branch: Option<String>,
}

pub async fn create_router() -> Result<Router> {
    let router = Router::new()
        .route("/", get(list_repositories).post(create_repository))
        .route("/:id", get(get_repository))
        .route("/:id/crawl", post(trigger_crawl));

    Ok(router)
}

async fn list_repositories() -> Result<Json<Vec<Repository>>, StatusCode> {
    // TODO: Implement actual repository listing from database
    Ok(Json(vec![]))
}

async fn get_repository(Path(id): Path<Uuid>) -> Result<Json<Repository>, StatusCode> {
    // TODO: Implement actual repository retrieval from database
    let _ = id;
    
    Err(StatusCode::NOT_FOUND)
}

async fn create_repository(
    Json(payload): Json<CreateRepositoryRequest>,
) -> Result<Json<Repository>, StatusCode> {
    // TODO: Implement actual repository creation in database
    let _ = payload;
    
    Err(StatusCode::NOT_IMPLEMENTED)
}

async fn trigger_crawl(Path(id): Path<Uuid>) -> Result<Json<String>, StatusCode> {
    // TODO: Implement actual crawling trigger
    let _ = id;
    
    Ok(Json("Crawl triggered".to_string()))
}
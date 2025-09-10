use anyhow::Result;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::database::Database;
use crate::models::{Repository, RepositoryType};
use crate::repositories::RepositoryRepository;


#[derive(Debug, Deserialize)]
pub struct CreateRepositoryRequest {
    pub name: String,
    pub url: String,
    pub repository_type: RepositoryType,
    pub branch: Option<String>,
}

pub async fn create_router(database: Database) -> Result<Router> {
    let router = Router::new()
        .route("/", get(list_repositories).post(create_repository))
        .route("/:id", get(get_repository))
        .route("/:id/crawl", post(trigger_crawl))
        .with_state(database);

    Ok(router)
}

async fn list_repositories(
    State(database): State<Database>,
) -> Result<Json<Vec<Repository>>, StatusCode> {
    let repo_repository = RepositoryRepository::new(database.pool().clone());
    
    match repo_repository.list_repositories().await {
        Ok(repositories) => Ok(Json(repositories)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_repository(
    State(database): State<Database>,
    Path(id): Path<Uuid>,
) -> Result<Json<Repository>, StatusCode> {
    let repo_repository = RepositoryRepository::new(database.pool().clone());
    
    match repo_repository.get_repository(id).await {
        Ok(Some(repository)) => Ok(Json(repository)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn create_repository(
    State(database): State<Database>,
    Json(payload): Json<CreateRepositoryRequest>,
) -> Result<Json<Repository>, StatusCode> {
    let repo_repository = RepositoryRepository::new(database.pool().clone());
    
    let new_repository = Repository {
        id: uuid::Uuid::new_v4(),
        name: payload.name,
        url: payload.url,
        repository_type: payload.repository_type,
        branch: payload.branch,
        enabled: true,
        last_crawled: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };
    
    match repo_repository.create_repository(&new_repository).await {
        Ok(repository) => Ok(Json(repository)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn trigger_crawl(
    State(database): State<Database>,
    Path(id): Path<Uuid>,
) -> Result<Json<String>, StatusCode> {
    let repo_repository = RepositoryRepository::new(database.pool().clone());
    
    match repo_repository.update_last_crawled(id).await {
        Ok(_) => Ok(Json("Crawl triggered".to_string())),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}
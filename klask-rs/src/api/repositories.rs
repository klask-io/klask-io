use anyhow::Result;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::Deserialize;
use uuid::Uuid;
use crate::auth::extractors::{AppState, AuthenticatedUser, AdminUser};
use crate::models::{Repository, RepositoryType};
use crate::repositories::RepositoryRepository;


#[derive(Debug, Deserialize)]
pub struct CreateRepositoryRequest {
    pub name: String,
    pub url: String,
    pub repository_type: RepositoryType,
    pub branch: Option<String>,
}

pub async fn create_router() -> Result<Router<AppState>> {
    let router = Router::new()
        .route("/", get(list_repositories).post(create_repository))
        .route("/:id", get(get_repository))
        .route("/:id/crawl", post(trigger_crawl));

    Ok(router)
}

async fn list_repositories(
    State(app_state): State<AppState>,
    _auth_user: AuthenticatedUser, // Require authentication
) -> Result<Json<Vec<Repository>>, StatusCode> {
    let repo_repository = RepositoryRepository::new(app_state.database.pool().clone());
    
    match repo_repository.list_repositories().await {
        Ok(repositories) => Ok(Json(repositories)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_repository(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
    _auth_user: AuthenticatedUser, // Require authentication
) -> Result<Json<Repository>, StatusCode> {
    let repo_repository = RepositoryRepository::new(app_state.database.pool().clone());
    
    match repo_repository.get_repository(id).await {
        Ok(Some(repository)) => Ok(Json(repository)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn create_repository(
    State(app_state): State<AppState>,
    AdminUser(_admin_user): AdminUser, // Require admin authentication
    Json(payload): Json<CreateRepositoryRequest>,
) -> Result<Json<Repository>, StatusCode> {
    let repo_repository = RepositoryRepository::new(app_state.database.pool().clone());
    
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
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
    AdminUser(_admin_user): AdminUser, // Require admin authentication
) -> Result<Json<String>, StatusCode> {
    let repo_repository = RepositoryRepository::new(app_state.database.pool().clone());
    
    // Get the repository to crawl
    let repository = match repo_repository.get_repository(id).await {
        Ok(Some(repo)) => repo,
        Ok(None) => return Err(StatusCode::NOT_FOUND),
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };
    
    // Check if repository is enabled
    if !repository.enabled {
        return Err(StatusCode::BAD_REQUEST);
    }
    
    // Spawn background task for crawling
    let crawler_service = app_state.crawler_service.clone();
    let repo_clone = repository.clone();
    
    tokio::spawn(async move {
        if let Err(e) = crawler_service.crawl_repository(&repo_clone).await {
            tracing::error!("Failed to crawl repository {}: {}", repo_clone.name, e);
        }
    });
    
    Ok(Json("Crawl started in background".to_string()))
}
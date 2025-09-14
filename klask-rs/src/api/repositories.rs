use anyhow::Result;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post, put},
    Router,
};
use serde::Deserialize;
use uuid::Uuid;
use crate::auth::extractors::{AppState, AuthenticatedUser, AdminUser};
use crate::models::{Repository, RepositoryType};
use crate::repositories::RepositoryRepository;
use crate::services::EncryptionService;


#[derive(Debug, Deserialize)]
pub struct CreateRepositoryRequest {
    pub name: String,
    pub url: String,
    #[serde(alias = "repositoryType")]
    pub repository_type: RepositoryType,
    pub branch: Option<String>,
    pub enabled: Option<bool>,
    #[serde(alias = "accessToken")]
    pub access_token: Option<String>,
    #[serde(alias = "gitlabNamespace")]
    pub gitlab_namespace: Option<String>,
    #[serde(alias = "isGroup")]
    pub is_group: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRepositoryRequest {
    pub name: Option<String>,
    pub url: Option<String>,
    #[serde(alias = "repositoryType")]
    pub repository_type: Option<RepositoryType>,
    pub branch: Option<String>,
    pub enabled: Option<bool>,
    #[serde(alias = "accessToken")]
    pub access_token: Option<String>,
    #[serde(alias = "gitlabNamespace")]
    pub gitlab_namespace: Option<String>,
    #[serde(alias = "isGroup")]
    pub is_group: Option<bool>,
}

pub async fn create_router() -> Result<Router<AppState>> {
    let router = Router::new()
        .route("/", get(list_repositories).post(create_repository))
        .route("/:id", get(get_repository).put(update_repository).delete(delete_repository))
        .route("/:id/crawl", post(trigger_crawl));

    Ok(router)
}

async fn list_repositories(
    State(app_state): State<AppState>,
    _admin_user: AdminUser, // Require admin authentication
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
    _admin_user: AdminUser, // Require admin authentication
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
    _admin_user: AdminUser, // Require admin authentication
    Json(payload): Json<CreateRepositoryRequest>,
) -> Result<Json<Repository>, StatusCode> {
    let repo_repository = RepositoryRepository::new(app_state.database.pool().clone());
    
    // Encrypt access token if provided
    let encrypted_token = if let Some(token) = &payload.access_token {
        if !token.is_empty() {
            // Get encryption key from config or environment
            let encryption_key = std::env::var("ENCRYPTION_KEY")
                .unwrap_or_else(|_| "default-encryption-key-change-me".to_string());
            
            match EncryptionService::new(&encryption_key) {
                Ok(encryption_service) => {
                    match encryption_service.encrypt(token) {
                        Ok(encrypted) => Some(encrypted),
                        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
                    }
                },
                Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
            }
        } else {
            None
        }
    } else {
        None
    };
    
    let new_repository = Repository {
        id: uuid::Uuid::new_v4(),
        name: payload.name,
        url: payload.url,
        repository_type: payload.repository_type,
        branch: payload.branch,
        enabled: payload.enabled.unwrap_or(true),
        access_token: encrypted_token,
        gitlab_namespace: payload.gitlab_namespace,
        is_group: payload.is_group.unwrap_or(false),
        last_crawled: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        // Scheduling fields
        auto_crawl_enabled: false,
        cron_schedule: None,
        next_crawl_at: None,
        crawl_frequency_hours: None,
        max_crawl_duration_minutes: Some(60),
    };
    
    match repo_repository.create_repository(&new_repository).await {
        Ok(repository) => Ok(Json(repository)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn update_repository(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
    _admin_user: AdminUser, // Require admin authentication
    Json(payload): Json<UpdateRepositoryRequest>,
) -> Result<Json<Repository>, StatusCode> {
    let repo_repository = RepositoryRepository::new(app_state.database.pool().clone());
    
    // Get existing repository to preserve fields not provided in payload
    let existing_repository = match repo_repository.get_repository(id).await {
        Ok(Some(repo)) => repo,
        Ok(None) => return Err(StatusCode::NOT_FOUND),
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };
    
    // Handle access token: preserve existing if not provided or empty in payload
    let encrypted_token = if let Some(token) = &payload.access_token {
        if !token.is_empty() {
            // Get encryption key from config or environment
            let encryption_key = std::env::var("ENCRYPTION_KEY")
                .unwrap_or_else(|_| "default-encryption-key-change-me".to_string());
            
            match EncryptionService::new(&encryption_key) {
                Ok(encryption_service) => {
                    match encryption_service.encrypt(token) {
                        Ok(encrypted) => Some(encrypted),
                        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
                    }
                },
                Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
            }
        } else {
            // Token provided but empty, preserve existing
            existing_repository.access_token
        }
    } else {
        // No token provided in payload, preserve existing
        existing_repository.access_token
    };
    
    let updated_repository = Repository {
        id,
        name: payload.name.unwrap_or(existing_repository.name),
        url: payload.url.unwrap_or(existing_repository.url),
        repository_type: payload.repository_type.unwrap_or(existing_repository.repository_type),
        branch: payload.branch.or(existing_repository.branch),
        enabled: payload.enabled.unwrap_or(existing_repository.enabled),
        access_token: encrypted_token,
        gitlab_namespace: payload.gitlab_namespace.or(existing_repository.gitlab_namespace),
        is_group: payload.is_group.unwrap_or(existing_repository.is_group),
        last_crawled: existing_repository.last_crawled, // Preserve existing value
        created_at: existing_repository.created_at, // Preserve existing value
        updated_at: chrono::Utc::now(), // Will be set by the database
        // Scheduling fields - preserve existing values
        auto_crawl_enabled: existing_repository.auto_crawl_enabled,
        cron_schedule: existing_repository.cron_schedule,
        next_crawl_at: existing_repository.next_crawl_at,
        crawl_frequency_hours: existing_repository.crawl_frequency_hours,
        max_crawl_duration_minutes: existing_repository.max_crawl_duration_minutes,
    };
    
    match repo_repository.update_repository(id, &updated_repository).await {
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

async fn delete_repository(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
    _admin_user: AdminUser, // Require admin authentication
) -> Result<StatusCode, StatusCode> {
    let repo_repository = RepositoryRepository::new(app_state.database.pool().clone());
    
    // Check if repository exists
    match repo_repository.get_repository(id).await {
        Ok(Some(_)) => {
            // Repository exists, delete it
            match repo_repository.delete_repository(id).await {
                Ok(_) => Ok(StatusCode::NO_CONTENT),
                Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
            }
        },
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}
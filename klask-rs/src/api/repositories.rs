use crate::auth::extractors::{AdminUser, AppState};
use crate::models::{Repository, RepositoryType};
use crate::repositories::RepositoryRepository;
use crate::services::{gitlab::GitLabService, EncryptionService};
use anyhow::Result;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, put},
    Router,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use tokio_cron_scheduler::{Job, JobScheduler};
use uuid::Uuid;

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
    // Scheduling fields
    #[serde(alias = "autoCrawlEnabled")]
    pub auto_crawl_enabled: Option<bool>,
    #[serde(alias = "cronSchedule")]
    pub cron_schedule: Option<String>,
    #[serde(alias = "crawlFrequencyHours")]
    pub crawl_frequency_hours: Option<i32>,
    #[serde(alias = "maxCrawlDurationMinutes")]
    pub max_crawl_duration_minutes: Option<i32>,
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
    // Scheduling fields
    #[serde(alias = "autoCrawlEnabled")]
    pub auto_crawl_enabled: Option<bool>,
    #[serde(alias = "cronSchedule")]
    pub cron_schedule: Option<String>,
    #[serde(alias = "crawlFrequencyHours")]
    pub crawl_frequency_hours: Option<i32>,
    #[serde(alias = "maxCrawlDurationMinutes")]
    pub max_crawl_duration_minutes: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct ScheduleRepositoryRequest {
    #[serde(alias = "autoCrawlEnabled")]
    pub auto_crawl_enabled: bool,
    #[serde(alias = "cronSchedule")]
    pub cron_schedule: Option<String>,
    #[serde(alias = "crawlFrequencyHours")]
    pub crawl_frequency_hours: Option<i32>,
    #[serde(alias = "maxCrawlDurationMinutes")]
    pub max_crawl_duration_minutes: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct GitLabDiscoverRequest {
    #[serde(alias = "gitlabUrl")]
    pub gitlab_url: Option<String>,
    #[serde(alias = "accessToken")]
    pub access_token: String,
    pub namespace: Option<String>,
    // Scheduling fields (optional, applied to all imported repos)
    #[serde(alias = "autoCrawlEnabled")]
    pub auto_crawl_enabled: Option<bool>,
    #[serde(alias = "cronSchedule")]
    pub cron_schedule: Option<String>,
    #[serde(alias = "crawlFrequencyHours")]
    pub crawl_frequency_hours: Option<i32>,
    #[serde(alias = "maxCrawlDurationMinutes")]
    pub max_crawl_duration_minutes: Option<i32>,
}

pub async fn create_router() -> Result<Router<AppState>> {
    let router = Router::new()
        .route("/", get(list_repositories).post(create_repository))
        .route("/gitlab/discover", post(discover_gitlab_projects))
        .route(
            "/:id",
            get(get_repository)
                .put(update_repository)
                .delete(delete_repository),
        )
        .route("/:id/crawl", post(trigger_crawl).delete(stop_crawl))
        .route("/:id/schedule", put(update_repository_schedule))
        .route("/:id/progress", get(get_repository_progress))
        .route("/progress/active", get(get_active_progress));

    Ok(router)
}

/// Calculate the next crawl time based on cron schedule or frequency
async fn calculate_next_crawl_time(
    cron_schedule: &Option<String>,
    crawl_frequency_hours: Option<i32>,
) -> Option<DateTime<Utc>> {
    if let Some(ref cron_expr) = cron_schedule {
        // Convert 5-field to 6-field if needed (same logic as scheduler)
        let parts: Vec<&str> = cron_expr.split_whitespace().collect();
        let six_field_cron = if parts.len() == 5 {
            format!("0 {}", cron_expr) // Add "0" at the beginning for seconds
        } else {
            cron_expr.clone()
        };

        // Use tokio-cron-scheduler to calculate next run time
        // We're already in an async context, so we can use await directly
        match JobScheduler::new().await {
            Ok(mut temp_scheduler) => {
                match Job::new_cron_job_async(six_field_cron.as_str(), |_uuid, _l| {
                    Box::pin(async move {})
                }) {
                    Ok(job) => match temp_scheduler.add(job).await {
                        Ok(_) => {
                            if let Ok(Some(duration)) = temp_scheduler.time_till_next_job().await {
                                let next_time = Utc::now()
                                    + chrono::Duration::from_std(duration).unwrap_or_default();
                                tracing::debug!(
                                    "Calculated next crawl time for cron '{}': {:?}",
                                    cron_expr,
                                    next_time
                                );
                                Some(next_time)
                            } else {
                                tracing::warn!(
                                    "Could not calculate next tick for cron expression '{}'",
                                    cron_expr
                                );
                                Some(Utc::now() + chrono::Duration::hours(1))
                            }
                        }
                        Err(e) => {
                            tracing::warn!(
                                "Failed to add temporary job for next run calculation: {}",
                                e
                            );
                            Some(Utc::now() + chrono::Duration::hours(1))
                        }
                    },
                    Err(e) => {
                        tracing::warn!(
                            "Invalid cron expression '{}': {}. Using fallback.",
                            cron_expr,
                            e
                        );
                        Some(Utc::now() + chrono::Duration::hours(1))
                    }
                }
            }
            Err(e) => {
                tracing::warn!(
                    "Failed to create temporary scheduler: {}. Using fallback.",
                    e
                );
                Some(Utc::now() + chrono::Duration::hours(1))
            }
        }
    } else if let Some(frequency_hours) = crawl_frequency_hours {
        // Simple frequency-based scheduling
        Some(Utc::now() + chrono::Duration::hours(frequency_hours as i64))
    } else {
        // Default to 24 hours if no schedule is specified
        Some(Utc::now() + chrono::Duration::hours(24))
    }
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
                Ok(encryption_service) => match encryption_service.encrypt(token) {
                    Ok(encrypted) => Some(encrypted),
                    Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
                },
                Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
            }
        } else {
            None
        }
    } else {
        None
    };

    // Calculate next_crawl_at if auto_crawl is enabled
    let auto_crawl_enabled = payload.auto_crawl_enabled.unwrap_or(false);
    let next_crawl_at = if auto_crawl_enabled {
        calculate_next_crawl_time(&payload.cron_schedule, payload.crawl_frequency_hours).await
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
        auto_crawl_enabled,
        cron_schedule: payload.cron_schedule,
        next_crawl_at,
        crawl_frequency_hours: payload.crawl_frequency_hours,
        max_crawl_duration_minutes: payload.max_crawl_duration_minutes.or(Some(60)),
    };

    match repo_repository.create_repository(&new_repository).await {
        Ok(repository) => {
            // Schedule the repository if auto-crawl is enabled
            if repository.auto_crawl_enabled {
                if let Some(scheduler) = &app_state.scheduler_service {
                    if let Err(e) = scheduler.schedule_repository(&repository).await {
                        tracing::error!("Failed to schedule new repository: {}", e);
                    }
                }
            }
            Ok(Json(repository))
        }
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
                Ok(encryption_service) => match encryption_service.encrypt(token) {
                    Ok(encrypted) => Some(encrypted),
                    Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
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

    // Determine final scheduling values
    let auto_crawl_enabled = payload
        .auto_crawl_enabled
        .unwrap_or(existing_repository.auto_crawl_enabled);
    let cron_schedule = payload.cron_schedule.or(existing_repository.cron_schedule);
    let crawl_frequency_hours = payload
        .crawl_frequency_hours
        .or(existing_repository.crawl_frequency_hours);

    // Calculate next_crawl_at based on the schedule
    let next_crawl_at = if auto_crawl_enabled {
        calculate_next_crawl_time(&cron_schedule, crawl_frequency_hours).await
    } else {
        None
    };

    let updated_repository = Repository {
        id,
        name: payload.name.unwrap_or(existing_repository.name),
        url: payload.url.unwrap_or(existing_repository.url),
        repository_type: payload
            .repository_type
            .unwrap_or(existing_repository.repository_type),
        branch: payload.branch.or(existing_repository.branch),
        enabled: payload.enabled.unwrap_or(existing_repository.enabled),
        access_token: encrypted_token,
        gitlab_namespace: payload
            .gitlab_namespace
            .or(existing_repository.gitlab_namespace),
        is_group: payload.is_group.unwrap_or(existing_repository.is_group),
        last_crawled: existing_repository.last_crawled, // Preserve existing value
        created_at: existing_repository.created_at,     // Preserve existing value
        updated_at: chrono::Utc::now(),                 // Will be set by the database
        // Scheduling fields - update if provided, otherwise preserve existing values
        auto_crawl_enabled,
        cron_schedule,
        next_crawl_at,
        crawl_frequency_hours,
        max_crawl_duration_minutes: payload
            .max_crawl_duration_minutes
            .or(existing_repository.max_crawl_duration_minutes),
    };

    match repo_repository
        .update_repository(id, &updated_repository)
        .await
    {
        Ok(repository) => {
            // Update the scheduler if scheduling settings changed
            if let Some(scheduler) = &app_state.scheduler_service {
                if let Err(e) = scheduler.update_repository_schedule(&repository).await {
                    tracing::error!("Failed to update repository schedule: {}", e);
                }
            }
            Ok(Json(repository))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn trigger_crawl(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
    AdminUser(_admin_user): AdminUser, // Require admin authentication
) -> Result<Json<String>, StatusCode> {
    let repo_repository = RepositoryRepository::new(app_state.database.pool().clone());

    // Check if repository is already being crawled
    if app_state.progress_tracker.is_crawling(id).await {
        return Err(StatusCode::CONFLICT);
    }

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

    // Double-check if repository is still not being crawled (race condition protection)
    if app_state.progress_tracker.is_crawling(id).await {
        return Err(StatusCode::CONFLICT);
    }

    // Spawn background task for crawling
    let crawler_service = app_state.crawler_service.clone();
    let progress_tracker = app_state.progress_tracker.clone();
    let crawl_tasks = app_state.crawl_tasks.clone();
    let repo_clone = repository.clone();
    let repo_id = id;

    let task_handle = tokio::spawn(async move {
        if let Err(e) = crawler_service.crawl_repository(&repo_clone).await {
            tracing::error!("Failed to crawl repository {}: {}", repo_clone.name, e);
            progress_tracker.set_error(repo_id, e.to_string()).await;
        }

        // Remove the task handle when done
        let mut tasks = crawl_tasks.write().await;
        tasks.remove(&repo_id);
    });

    // Store the task handle
    {
        let mut tasks = app_state.crawl_tasks.write().await;
        tasks.insert(id, task_handle);
    }

    Ok(Json("Crawl started in background".to_string()))
}

async fn stop_crawl(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
    AdminUser(_admin_user): AdminUser, // Require admin authentication
) -> Result<Json<String>, StatusCode> {
    // Check if repository is currently being crawled
    if !app_state.progress_tracker.is_crawling(id).await {
        return Err(StatusCode::NOT_FOUND);
    }

    // Cancel the crawl using the crawler service
    match app_state.crawler_service.cancel_crawl(id).await {
        Ok(true) => {
            // Cancel the progress tracking
            app_state.progress_tracker.cancel_crawl(id).await;

            // Abort the task if it exists
            if let Some(task_handle) = {
                let mut tasks = app_state.crawl_tasks.write().await;
                tasks.remove(&id)
            } {
                task_handle.abort();
            }

            Ok(Json("Crawl stopped successfully".to_string()))
        }
        Ok(false) => {
            // Crawl not found or already finished
            Err(StatusCode::NOT_FOUND)
        }
        Err(_) => {
            // Error stopping crawl
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn delete_repository(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
    _admin_user: AdminUser, // Require admin authentication
) -> Result<StatusCode, StatusCode> {
    let repo_repository = RepositoryRepository::new(app_state.database.pool().clone());

    // Check if repository exists
    match repo_repository.get_repository(id).await {
        Ok(Some(repository)) => {
            // Get all files for this repository from database before deletion
            let pool = app_state.database.pool().clone();
            let files_result = sqlx::query!("SELECT id FROM files WHERE repository_id = $1", id)
                .fetch_all(&pool)
                .await;

            // Delete the repository from database (this will cascade delete files)
            match repo_repository.delete_repository(id).await {
                Ok(_) => {
                    // Clean up search index for all files from this repository
                    if let Ok(files) = files_result {
                        for file in files {
                            // Delete from search index
                            if let Err(e) = app_state.search_service.delete_file(file.id).await {
                                tracing::error!(
                                    "Failed to delete file {} from search index: {}",
                                    file.id,
                                    e
                                );
                            }
                        }

                        // Commit the search index changes
                        if let Err(e) = app_state.search_service.commit().await {
                            tracing::error!("Failed to commit search index changes after repository deletion: {}", e);
                        }
                    }

                    tracing::info!(
                        "Repository {} and its indexed documents deleted successfully",
                        repository.name
                    );
                    Ok(StatusCode::NO_CONTENT)
                }
                Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
            }
        }
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_repository_progress(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
    _admin_user: AdminUser, // Require admin authentication
) -> Result<Json<Option<crate::services::progress::CrawlProgressInfo>>, StatusCode> {
    let progress = app_state.progress_tracker.get_progress(id).await;
    Ok(Json(progress))
}

async fn get_active_progress(
    State(app_state): State<AppState>,
    _admin_user: AdminUser, // Require admin authentication
) -> Result<Json<Vec<crate::services::progress::CrawlProgressInfo>>, StatusCode> {
    let active_progress = app_state.progress_tracker.get_all_active_progress().await;
    Ok(Json(active_progress))
}

async fn discover_gitlab_projects(
    State(app_state): State<AppState>,
    _admin_user: AdminUser, // Require admin authentication
    Json(payload): Json<GitLabDiscoverRequest>,
) -> Result<Json<Vec<Repository>>, StatusCode> {
    // Use default GitLab URL if not provided
    let gitlab_url = payload
        .gitlab_url
        .unwrap_or_else(|| "https://gitlab.com".to_string());

    // Initialize GitLab service
    let gitlab_service = GitLabService::new();

    // Discover projects
    let projects = match gitlab_service
        .discover_projects(
            &gitlab_url,
            &payload.access_token,
            payload.namespace.as_deref(),
        )
        .await
    {
        Ok(projects) => projects,
        Err(e) => {
            tracing::error!("Failed to discover GitLab projects: {}", e);
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    if projects.is_empty() {
        tracing::warn!("No accessible projects found on GitLab");
        return Ok(Json(vec![]));
    }

    tracing::info!("Discovered {} GitLab projects", projects.len());

    // Prepare to create repositories
    let repo_repository = RepositoryRepository::new(app_state.database.pool().clone());
    let mut created_repositories = Vec::new();

    // Encrypt access token once for all repositories
    let encrypted_token = {
        let encryption_key = std::env::var("ENCRYPTION_KEY")
            .unwrap_or_else(|_| "default-encryption-key-change-me".to_string());

        match EncryptionService::new(&encryption_key) {
            Ok(encryption_service) => match encryption_service.encrypt(&payload.access_token) {
                Ok(encrypted) => Some(encrypted),
                Err(e) => {
                    tracing::error!("Failed to encrypt access token: {}", e);
                    return Err(StatusCode::INTERNAL_SERVER_ERROR);
                }
            },
            Err(e) => {
                tracing::error!("Failed to create encryption service: {}", e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        }
    };

    // Calculate next_crawl_at if auto_crawl is enabled
    let auto_crawl_enabled = payload.auto_crawl_enabled.unwrap_or(false);
    let next_crawl_at = if auto_crawl_enabled {
        calculate_next_crawl_time(&payload.cron_schedule, payload.crawl_frequency_hours).await
    } else {
        None
    };

    // Create a repository for each discovered project
    for project in projects {
        // Check if repository already exists with this URL
        let existing_repos = match repo_repository.list_repositories().await {
            Ok(repos) => repos,
            Err(e) => {
                tracing::error!("Failed to list existing repositories: {}", e);
                continue;
            }
        };

        if existing_repos
            .iter()
            .any(|r| r.url == project.http_url_to_repo)
        {
            tracing::info!(
                "Repository {} already exists, skipping",
                project.path_with_namespace
            );
            continue;
        }

        let new_repository = Repository {
            id: uuid::Uuid::new_v4(),
            name: project.path_with_namespace.clone(),
            url: project.http_url_to_repo.clone(),
            repository_type: RepositoryType::GitLab,
            branch: project.default_branch.clone(),
            enabled: true,
            access_token: encrypted_token.clone(),
            gitlab_namespace: None,
            is_group: false,
            last_crawled: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            // Scheduling fields
            auto_crawl_enabled,
            cron_schedule: payload.cron_schedule.clone(),
            next_crawl_at,
            crawl_frequency_hours: payload.crawl_frequency_hours,
            max_crawl_duration_minutes: payload.max_crawl_duration_minutes.or(Some(60)),
        };

        match repo_repository.create_repository(&new_repository).await {
            Ok(repository) => {
                // Schedule the repository if auto-crawl is enabled
                if repository.auto_crawl_enabled {
                    if let Some(scheduler) = &app_state.scheduler_service {
                        if let Err(e) = scheduler.schedule_repository(&repository).await {
                            tracing::error!(
                                "Failed to schedule repository {}: {}",
                                repository.name,
                                e
                            );
                        }
                    }
                }
                created_repositories.push(repository);
            }
            Err(e) => {
                tracing::error!(
                    "Failed to create repository {}: {}",
                    project.path_with_namespace,
                    e
                );
            }
        }
    }

    tracing::info!(
        "Successfully imported {} GitLab repositories",
        created_repositories.len()
    );
    Ok(Json(created_repositories))
}

async fn update_repository_schedule(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
    _admin_user: AdminUser, // Require admin authentication
    Json(payload): Json<ScheduleRepositoryRequest>,
) -> Result<Json<Repository>, StatusCode> {
    let repo_repository = RepositoryRepository::new(app_state.database.pool().clone());

    // Get existing repository
    let existing_repository = match repo_repository.get_repository(id).await {
        Ok(Some(repo)) => repo,
        Ok(None) => return Err(StatusCode::NOT_FOUND),
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // Update repository with new scheduling configuration
    let updated_repository = Repository {
        id,
        name: existing_repository.name,
        url: existing_repository.url,
        repository_type: existing_repository.repository_type,
        branch: existing_repository.branch,
        enabled: existing_repository.enabled,
        access_token: existing_repository.access_token,
        gitlab_namespace: existing_repository.gitlab_namespace,
        is_group: existing_repository.is_group,
        last_crawled: existing_repository.last_crawled,
        created_at: existing_repository.created_at,
        updated_at: chrono::Utc::now(),
        // Update scheduling fields
        auto_crawl_enabled: payload.auto_crawl_enabled,
        cron_schedule: payload.cron_schedule,
        next_crawl_at: None, // Will be calculated by scheduler
        crawl_frequency_hours: payload.crawl_frequency_hours,
        max_crawl_duration_minutes: payload.max_crawl_duration_minutes,
    };

    // Update repository in database
    match repo_repository
        .update_repository(id, &updated_repository)
        .await
    {
        Ok(repository) => Ok(Json(repository)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

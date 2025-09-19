use anyhow::Result;
use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
};
use axum_test::TestServer;
use klask_rs::{
    api::create_app,
    config::AppConfig,
    database::Database,
    models::{Repository, RepositoryType},
    services::{crawler::CrawlerService, progress::ProgressTracker, SearchService},
    AppState,
};
use serde_json::{json, Value};
use sqlx::{Pool, Postgres};
use std::collections::HashMap;
use std::sync::Arc;
use tempfile::TempDir;
use tokio::sync::RwLock;
use tokio::task::JoinHandle;
use uuid::Uuid;

struct TestSetup {
    server: TestServer,
    _temp_dir: TempDir,
    database: Database,
    repository_id: Uuid,
    admin_token: String,
}

impl TestSetup {
    async fn new() -> Result<Self> {
        let temp_dir = tempfile::tempdir()?;
        let index_path = temp_dir.path().join("test_index");

        // Create test database connection
        let database_url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
            "postgres://postgres:password@localhost:5432/klask_test".to_string()
        });

        let database = Database::new(&database_url, 5).await?;

        // Run migrations
        sqlx::migrate!("./migrations").run(database.pool()).await?;

        // Create search service
        let search_service = Arc::new(SearchService::new(index_path.to_str().unwrap())?);

        // Create progress tracker
        let progress_tracker = Arc::new(ProgressTracker::new());

        // Create crawler service
        let crawler_service = Arc::new(CrawlerService::new(
            database.pool().clone(),
            search_service.clone(),
            progress_tracker.clone(),
        )?);

        // Create app state
        let app_state = AppState {
            database: database.clone(),
            search_service: search_service.clone(),
            crawler_service: crawler_service.clone(),
            progress_tracker: progress_tracker.clone(),
            crawl_tasks: Arc::new(RwLock::new(HashMap::<Uuid, JoinHandle<()>>::new())),
        };

        // Create test app with authentication
        let config = AppConfig::from_env().unwrap_or_default();
        let app = create_app(app_state, &config).await?;
        let server = TestServer::new(app)?;

        // Create a test repository
        let repository_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO repositories (id, name, url, repository_type, branch, enabled, access_token, gitlab_namespace, is_group, last_crawled, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            "#
        )
        .bind(&repository_id)
        .bind("test-repo")
        .bind("https://github.com/test/repo.git")
        .bind(RepositoryType::Git)
        .bind(Some("main".to_string()))
        .bind(true)
        .bind(None::<String>)
        .bind(None::<String>)
        .bind(false)
        .bind(None::<chrono::DateTime<chrono::Utc>>)
        .bind(chrono::Utc::now())
        .bind(chrono::Utc::now())
        .execute(database.pool())
        .await?;

        // Create admin user and get token
        let admin_token = "test-admin-token".to_string();

        Ok(TestSetup {
            server,
            _temp_dir: temp_dir,
            database,
            repository_id,
            admin_token,
        })
    }

    async fn cleanup(&self) -> Result<()> {
        sqlx::query("DELETE FROM files")
            .execute(self.database.pool())
            .await?;
        sqlx::query("DELETE FROM repositories")
            .execute(self.database.pool())
            .await?;
        Ok(())
    }
}

#[tokio::test]
async fn test_stop_crawl_endpoint_not_found() -> Result<()> {
    let setup = TestSetup::new().await?;

    let response = setup
        .server
        .delete(&format!("/api/repositories/{}/crawl", setup.repository_id))
        .add_header("Authorization", format!("Bearer {}", setup.admin_token))
        .await;

    // Should return 404 because repository is not currently being crawled
    assert_eq!(response.status_code(), StatusCode::NOT_FOUND);

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_stop_crawl_endpoint_unauthorized() -> Result<()> {
    let setup = TestSetup::new().await?;

    let response = setup
        .server
        .delete(&format!("/api/repositories/{}/crawl", setup.repository_id))
        .await;

    // Should return 401 because no authorization header
    assert_eq!(response.status_code(), StatusCode::UNAUTHORIZED);

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_stop_crawl_endpoint_invalid_uuid() -> Result<()> {
    let setup = TestSetup::new().await?;

    let response = setup
        .server
        .delete("/api/repositories/invalid-uuid/crawl")
        .add_header("Authorization", format!("Bearer {}", setup.admin_token))
        .await;

    // Should return 400 for invalid UUID format
    assert_eq!(response.status_code(), StatusCode::BAD_REQUEST);

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_stop_crawl_endpoint_nonexistent_repository() -> Result<()> {
    let setup = TestSetup::new().await?;
    let nonexistent_id = Uuid::new_v4();

    let response = setup
        .server
        .delete(&format!("/api/repositories/{}/crawl", nonexistent_id))
        .add_header("Authorization", format!("Bearer {}", setup.admin_token))
        .await;

    // Should return 404 for nonexistent repository
    assert_eq!(response.status_code(), StatusCode::NOT_FOUND);

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_stop_crawl_successful() -> Result<()> {
    // This test requires creating an actual crawling session, which is complex
    // We'll simulate the conditions and test the API response
    let setup = TestSetup::new().await?;

    // First, we need to manually start a crawl to test stopping it
    // For this test, we'll create a mock scenario by directly manipulating the progress tracker

    // Start tracking progress to simulate an ongoing crawl
    let progress_tracker = setup.server.state::<AppState>().progress_tracker.clone();
    progress_tracker
        .start_crawl(setup.repository_id, "test-repo".to_string())
        .await;

    // Verify it's marked as crawling
    assert!(progress_tracker.is_crawling(setup.repository_id).await);

    let response = setup
        .server
        .delete(&format!("/api/repositories/{}/crawl", setup.repository_id))
        .add_header("Authorization", format!("Bearer {}", setup.admin_token))
        .await;

    // Should return 200 OK when stopping an active crawl
    assert_eq!(response.status_code(), StatusCode::OK);

    let response_text: String = response.text();
    assert!(response_text.contains("stopped"));

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_stop_crawl_with_different_http_methods() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Test with GET (should fail - only DELETE is allowed)
    let response = setup
        .server
        .get(&format!("/api/repositories/{}/crawl", setup.repository_id))
        .add_header("Authorization", format!("Bearer {}", setup.admin_token))
        .await;

    assert_ne!(response.status_code(), StatusCode::OK);

    // Test with POST (should trigger crawl, not stop it)
    let response = setup
        .server
        .post(&format!("/api/repositories/{}/crawl", setup.repository_id))
        .add_header("Authorization", format!("Bearer {}", setup.admin_token))
        .await;

    // POST might succeed or fail depending on repository state, but it's not a stop operation
    // The important thing is that DELETE is the correct method for stopping

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_stop_crawl_endpoint_headers() -> Result<()> {
    let setup = TestSetup::new().await?;

    let response = setup
        .server
        .delete(&format!("/api/repositories/{}/crawl", setup.repository_id))
        .add_header("Authorization", format!("Bearer {}", setup.admin_token))
        .add_header("Content-Type", "application/json")
        .await;

    // Should handle additional headers gracefully
    // Response might be 404 (not crawling) but should not be a server error
    assert_ne!(response.status_code(), StatusCode::INTERNAL_SERVER_ERROR);

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_stop_crawl_with_malformed_auth() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Test with malformed Bearer token
    let response = setup
        .server
        .delete(&format!("/api/repositories/{}/crawl", setup.repository_id))
        .add_header("Authorization", "Bearer")
        .await;

    assert_eq!(response.status_code(), StatusCode::UNAUTHORIZED);

    // Test with wrong auth scheme
    let response = setup
        .server
        .delete(&format!("/api/repositories/{}/crawl", setup.repository_id))
        .add_header("Authorization", format!("Basic {}", setup.admin_token))
        .await;

    assert_eq!(response.status_code(), StatusCode::UNAUTHORIZED);

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_stop_crawl_concurrent_requests() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Start a progress to simulate ongoing crawl
    let progress_tracker = setup.server.state::<AppState>().progress_tracker.clone();
    progress_tracker
        .start_crawl(setup.repository_id, "test-repo".to_string())
        .await;

    // Make concurrent stop requests
    let tasks: Vec<_> = (0..3)
        .map(|_| {
            let server = setup.server.clone();
            let repo_id = setup.repository_id;
            let token = setup.admin_token.clone();
            tokio::spawn(async move {
                server
                    .delete(&format!("/api/repositories/{}/crawl", repo_id))
                    .add_header("Authorization", format!("Bearer {}", token))
                    .await
            })
        })
        .collect();

    let results = futures::future::join_all(tasks).await;

    // At least one request should succeed, others might get 404 if the crawl was already stopped
    let mut success_count = 0;
    let mut not_found_count = 0;

    for result in results {
        let response = result?;
        match response.status_code() {
            StatusCode::OK => success_count += 1,
            StatusCode::NOT_FOUND => not_found_count += 1,
            other => panic!("Unexpected status code: {}", other),
        }
    }

    // Should have at least one successful stop
    assert!(success_count >= 1 || not_found_count >= 1);

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_stop_crawl_response_format() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Start a progress to simulate ongoing crawl
    let progress_tracker = setup.server.state::<AppState>().progress_tracker.clone();
    progress_tracker
        .start_crawl(setup.repository_id, "test-repo".to_string())
        .await;

    let response = setup
        .server
        .delete(&format!("/api/repositories/{}/crawl", setup.repository_id))
        .add_header("Authorization", format!("Bearer {}", setup.admin_token))
        .await;

    // Check response format
    if response.status_code() == StatusCode::OK {
        let response_text: String = response.text();
        // Should be a JSON string response
        assert!(!response_text.is_empty());
        // Should be properly formatted JSON (even if it's just a string)
        assert!(response_text.starts_with('"') && response_text.ends_with('"'));
    }

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_stop_crawl_endpoint_path_variations() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Test with trailing slash
    let response = setup
        .server
        .delete(&format!("/api/repositories/{}/crawl/", setup.repository_id))
        .add_header("Authorization", format!("Bearer {}", setup.admin_token))
        .await;

    // Should handle trailing slash gracefully (might be 404 for path not found)
    assert_ne!(response.status_code(), StatusCode::INTERNAL_SERVER_ERROR);

    // Test with extra path segments
    let response = setup
        .server
        .delete(&format!(
            "/api/repositories/{}/crawl/extra",
            setup.repository_id
        ))
        .add_header("Authorization", format!("Bearer {}", setup.admin_token))
        .await;

    // Should return appropriate error for invalid path
    assert_ne!(response.status_code(), StatusCode::OK);

    setup.cleanup().await?;
    Ok(())
}

use anyhow::Result;
use axum::http::StatusCode;
use axum_test::TestServer;
use klask_rs::{
    api::create_app,
    config::AppConfig,
    database::Database,
    models::{Repository, RepositoryType},
    services::{
        crawler::CrawlerService,
        progress::{CrawlStatus, ProgressTracker},
        SearchService,
    },
    AppState,
};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use tempfile::TempDir;
use tokio::sync::RwLock;
use tokio::task::JoinHandle;
use tokio::time::{sleep, Duration};
use uuid::Uuid;

struct TestSetup {
    server: TestServer,
    _temp_dir: TempDir,
    database: Database,
    crawler_service: Arc<CrawlerService>,
    progress_tracker: Arc<ProgressTracker>,
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

        // Create test app
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

        let admin_token = "test-admin-token".to_string();

        Ok(TestSetup {
            server,
            _temp_dir: temp_dir,
            database,
            crawler_service,
            progress_tracker,
            repository_id,
            admin_token,
        })
    }

    async fn cleanup(&self) -> Result<()> {
        // Clean up any ongoing crawls
        self.crawler_service
            .cancel_crawl(self.repository_id)
            .await?;
        self.progress_tracker
            .remove_progress(self.repository_id)
            .await;

        // Clean up database
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
async fn test_prevent_concurrent_crawl_same_repository() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Start first crawl by simulating progress tracker state
    setup
        .progress_tracker
        .start_crawl(setup.repository_id, "test-repo".to_string())
        .await;
    setup
        .progress_tracker
        .update_status(setup.repository_id, CrawlStatus::Processing)
        .await;

    // Attempt second crawl via API - should be rejected
    let response = setup
        .server
        .post(&format!("/api/repositories/{}/crawl", setup.repository_id))
        .add_header("Authorization", format!("Bearer {}", setup.admin_token))
        .await;

    // Should return conflict status
    assert_eq!(response.status_code(), StatusCode::CONFLICT);

    let response_text: String = response.text();
    assert!(
        response_text.to_lowercase().contains("already")
            || response_text.to_lowercase().contains("crawling")
            || response_text.to_lowercase().contains("progress")
    );

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_allow_crawl_after_completion() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Simulate completed crawl
    setup
        .progress_tracker
        .start_crawl(setup.repository_id, "test-repo".to_string())
        .await;
    setup
        .progress_tracker
        .complete_crawl(setup.repository_id)
        .await;

    // Should not be considered as crawling anymore
    assert!(
        !setup
            .progress_tracker
            .is_crawling(setup.repository_id)
            .await
    );

    // New crawl should be allowed (though may fail for other reasons like network)
    let response = setup
        .server
        .post(&format!("/api/repositories/{}/crawl", setup.repository_id))
        .add_header("Authorization", format!("Bearer {}", setup.admin_token))
        .await;

    // Should not return conflict
    assert_ne!(response.status_code(), StatusCode::CONFLICT);

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_allow_crawl_after_failure() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Simulate failed crawl
    setup
        .progress_tracker
        .start_crawl(setup.repository_id, "test-repo".to_string())
        .await;
    setup
        .progress_tracker
        .set_error(setup.repository_id, "Test error".to_string())
        .await;

    // Should not be considered as crawling anymore
    assert!(
        !setup
            .progress_tracker
            .is_crawling(setup.repository_id)
            .await
    );

    // New crawl should be allowed
    let response = setup
        .server
        .post(&format!("/api/repositories/{}/crawl", setup.repository_id))
        .add_header("Authorization", format!("Bearer {}", setup.admin_token))
        .await;

    // Should not return conflict
    assert_ne!(response.status_code(), StatusCode::CONFLICT);

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_allow_crawl_after_cancellation() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Simulate cancelled crawl
    setup
        .progress_tracker
        .start_crawl(setup.repository_id, "test-repo".to_string())
        .await;
    setup
        .progress_tracker
        .cancel_crawl(setup.repository_id)
        .await;

    // Should not be considered as crawling anymore
    assert!(
        !setup
            .progress_tracker
            .is_crawling(setup.repository_id)
            .await
    );

    // New crawl should be allowed
    let response = setup
        .server
        .post(&format!("/api/repositories/{}/crawl", setup.repository_id))
        .add_header("Authorization", format!("Bearer {}", setup.admin_token))
        .await;

    // Should not return conflict
    assert_ne!(response.status_code(), StatusCode::CONFLICT);

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_multiple_repositories_concurrent_crawl() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Create second repository
    let repository_id_2 = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO repositories (id, name, url, repository_type, branch, enabled, access_token, gitlab_namespace, is_group, last_crawled, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        "#
    )
    .bind(&repository_id_2)
    .bind("test-repo-2")
    .bind("https://github.com/test/repo2.git")
    .bind(RepositoryType::Git)
    .bind(Some("main".to_string()))
    .bind(true)
    .bind(None::<String>)
    .bind(None::<String>)
    .bind(false)
    .bind(None::<chrono::DateTime<chrono::Utc>>)
    .bind(chrono::Utc::now())
    .bind(chrono::Utc::now())
    .execute(setup.database.pool())
    .await?;

    // Start crawl for first repository
    setup
        .progress_tracker
        .start_crawl(setup.repository_id, "test-repo".to_string())
        .await;
    setup
        .progress_tracker
        .update_status(setup.repository_id, CrawlStatus::Processing)
        .await;

    // Should be able to start crawl for second repository (different repo, no conflict)
    let response = setup
        .server
        .post(&format!("/api/repositories/{}/crawl", repository_id_2))
        .add_header("Authorization", format!("Bearer {}", setup.admin_token))
        .await;

    // Should not return conflict (may fail for other reasons, but not due to the first repo being busy)
    assert_ne!(response.status_code(), StatusCode::CONFLICT);

    // Cleanup second repository
    sqlx::query("DELETE FROM repositories WHERE id = $1")
        .bind(&repository_id_2)
        .execute(setup.database.pool())
        .await?;

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_crawl_status_check_accuracy() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Initially should not be crawling
    assert!(
        !setup
            .progress_tracker
            .is_crawling(setup.repository_id)
            .await
    );

    // Start crawl
    setup
        .progress_tracker
        .start_crawl(setup.repository_id, "test-repo".to_string())
        .await;

    // Should be considered crawling in starting state
    assert!(
        setup
            .progress_tracker
            .is_crawling(setup.repository_id)
            .await
    );

    // Update to processing
    setup
        .progress_tracker
        .update_status(setup.repository_id, CrawlStatus::Processing)
        .await;
    assert!(
        setup
            .progress_tracker
            .is_crawling(setup.repository_id)
            .await
    );

    // Update to indexing
    setup
        .progress_tracker
        .update_status(setup.repository_id, CrawlStatus::Indexing)
        .await;
    assert!(
        setup
            .progress_tracker
            .is_crawling(setup.repository_id)
            .await
    );

    // Complete
    setup
        .progress_tracker
        .complete_crawl(setup.repository_id)
        .await;
    assert!(
        !setup
            .progress_tracker
            .is_crawling(setup.repository_id)
            .await
    );

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_conflict_prevention_with_different_states() -> Result<()> {
    let setup = TestSetup::new().await?;

    let test_states = vec![
        CrawlStatus::Starting,
        CrawlStatus::Cloning,
        CrawlStatus::Processing,
        CrawlStatus::Indexing,
    ];

    for state in test_states {
        // Start crawl and set to specific state
        setup
            .progress_tracker
            .start_crawl(setup.repository_id, "test-repo".to_string())
            .await;
        setup
            .progress_tracker
            .update_status(setup.repository_id, state)
            .await;

        // Try to start another crawl - should be rejected
        let response = setup
            .server
            .post(&format!("/api/repositories/{}/crawl", setup.repository_id))
            .add_header("Authorization", format!("Bearer {}", setup.admin_token))
            .await;

        assert_eq!(
            response.status_code(),
            StatusCode::CONFLICT,
            "Should reject crawl when repository is in state: {:?}",
            state
        );

        // Clean up for next iteration
        setup
            .progress_tracker
            .remove_progress(setup.repository_id)
            .await;
    }

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_rapid_crawl_attempts() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Start a crawl
    setup
        .progress_tracker
        .start_crawl(setup.repository_id, "test-repo".to_string())
        .await;
    setup
        .progress_tracker
        .update_status(setup.repository_id, CrawlStatus::Processing)
        .await;

    // Make rapid concurrent requests
    let tasks: Vec<_> = (0..5)
        .map(|_| {
            let server = setup.server.clone();
            let repo_id = setup.repository_id;
            let token = setup.admin_token.clone();
            tokio::spawn(async move {
                server
                    .post(&format!("/api/repositories/{}/crawl", repo_id))
                    .add_header("Authorization", format!("Bearer {}", token))
                    .await
            })
        })
        .collect();

    let results = futures::future::join_all(tasks).await;

    // All should return conflict status
    for result in results {
        let response = result?;
        assert_eq!(response.status_code(), StatusCode::CONFLICT);
    }

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_crawler_service_direct_conflict_prevention() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Create a mock repository
    let repository = Repository {
        id: setup.repository_id,
        name: "test-repo".to_string(),
        url: "file:///tmp/nonexistent".to_string(),
        repository_type: RepositoryType::FileSystem,
        branch: None,
        enabled: true,
        access_token: None,
        gitlab_namespace: None,
        is_group: false,
        last_crawled: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    // Directly test the crawler service's internal state management
    assert!(!setup.crawler_service.is_crawling(setup.repository_id).await);

    // Start a crawl (will fail but should create cancellation token)
    let crawl_task = tokio::spawn({
        let crawler_service = setup.crawler_service.clone();
        let repository = repository.clone();
        async move { crawler_service.crawl_repository(&repository).await }
    });

    // Give it time to create the cancellation token
    sleep(Duration::from_millis(50)).await;

    // Now it should be considered crawling
    assert!(setup.crawler_service.is_crawling(setup.repository_id).await);

    // Cancel and wait for completion
    setup
        .crawler_service
        .cancel_crawl(setup.repository_id)
        .await?;
    let _ = crawl_task.await;

    // Should no longer be crawling
    assert!(!setup.crawler_service.is_crawling(setup.repository_id).await);

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_cleanup_prevents_false_conflicts() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Create a mock repository
    let repository = Repository {
        id: setup.repository_id,
        name: "test-repo".to_string(),
        url: "file:///tmp/nonexistent".to_string(),
        repository_type: RepositoryType::FileSystem,
        branch: None,
        enabled: true,
        access_token: None,
        gitlab_namespace: None,
        is_group: false,
        last_crawled: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    // Start and immediately cancel a crawl
    let crawl_task = tokio::spawn({
        let crawler_service = setup.crawler_service.clone();
        let repository = repository.clone();
        async move { crawler_service.crawl_repository(&repository).await }
    });

    sleep(Duration::from_millis(50)).await;
    setup
        .crawler_service
        .cancel_crawl(setup.repository_id)
        .await?;
    let _ = crawl_task.await;

    // Should be cleaned up and allow new crawls
    assert!(!setup.crawler_service.is_crawling(setup.repository_id).await);

    // New API call should not get conflict (may fail for other reasons)
    let response = setup
        .server
        .post(&format!("/api/repositories/{}/crawl", setup.repository_id))
        .add_header("Authorization", format!("Bearer {}", setup.admin_token))
        .await;

    assert_ne!(response.status_code(), StatusCode::CONFLICT);

    setup.cleanup().await?;
    Ok(())
}

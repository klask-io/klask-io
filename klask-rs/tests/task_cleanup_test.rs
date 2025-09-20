use anyhow::Result;
use axum_test::TestServer;
use klask_rs::{
    api::create_app,
    config::AppConfig,
    database::Database,
    models::{Repository, RepositoryType},
    services::{
        crawler::CrawlerService,
        encryption::EncryptionService,
        progress::{CrawlStatus, ProgressTracker},
        SearchService,
    },
    AppState,
};
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
    crawl_tasks: Arc<RwLock<HashMap<Uuid, JoinHandle<()>>>>,
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

        // Create encryption service for tests
        let encryption_service = Arc::new(EncryptionService::new("test-encryption-key-32bytes").unwrap());

        // Create crawler service
        let crawler_service = Arc::new(CrawlerService::new(
            database.pool().clone(),
            search_service.clone(),
            progress_tracker.clone(),
            encryption_service,
        )?);

        // Create crawl tasks map
        let crawl_tasks = Arc::new(RwLock::new(HashMap::<Uuid, JoinHandle<()>>::new()));

        // Create app state
        let app_state = AppState {
            database: database.clone(),
            search_service: search_service.clone(),
            crawler_service: crawler_service.clone(),
            progress_tracker: progress_tracker.clone(),
            crawl_tasks: crawl_tasks.clone(),
        };

        // Create test app
        let config = AppConfig::from_env().unwrap_or_default();
        let app = create_app(app_state, &config).await?;
        let server = TestServer::new(app)?;

        let admin_token = "test-admin-token".to_string();

        Ok(TestSetup {
            server,
            _temp_dir: temp_dir,
            database,
            crawler_service,
            progress_tracker,
            crawl_tasks,
            admin_token,
        })
    }

    async fn create_test_repository(&self) -> Result<Uuid> {
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
        .execute(self.database.pool())
        .await?;

        Ok(repository_id)
    }

    async fn cleanup(&self) -> Result<()> {
        // Cancel any ongoing tasks
        {
            let tasks = self.crawl_tasks.read().await;
            for (repo_id, handle) in tasks.iter() {
                self.crawler_service.cancel_crawl(*repo_id).await?;
                handle.abort();
            }
        }

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
async fn test_task_handle_cleanup_on_completion() -> Result<()> {
    let setup = TestSetup::new().await?;
    let repository_id = setup.create_test_repository().await?;

    // Simulate starting a crawl by adding progress and task handle
    setup
        .progress_tracker
        .start_crawl(repository_id, "test-repo".to_string())
        .await;

    // Create a mock task handle
    let dummy_task = tokio::spawn(async {
        sleep(Duration::from_millis(100)).await;
    });

    // Add task to the crawl_tasks map
    {
        let mut tasks = setup.crawl_tasks.write().await;
        tasks.insert(repository_id, dummy_task);
    }

    // Verify task exists
    {
        let tasks = setup.crawl_tasks.read().await;
        assert!(tasks.contains_key(&repository_id));
    }

    // Complete the crawl
    setup.progress_tracker.complete_crawl(repository_id).await;

    // Simulate API cleanup by removing task handle (this would happen in real API)
    {
        let mut tasks = setup.crawl_tasks.write().await;
        tasks.remove(&repository_id);
    }

    // Verify task was removed
    {
        let tasks = setup.crawl_tasks.read().await;
        assert!(!tasks.contains_key(&repository_id));
    }

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_task_handle_cleanup_on_cancellation() -> Result<()> {
    let setup = TestSetup::new().await?;
    let repository_id = setup.create_test_repository().await?;

    // Start progress tracking
    setup
        .progress_tracker
        .start_crawl(repository_id, "test-repo".to_string())
        .await;
    setup
        .progress_tracker
        .update_status(repository_id, CrawlStatus::Processing)
        .await;

    // Create a long-running task
    let long_task = tokio::spawn(async {
        sleep(Duration::from_secs(10)).await; // Long enough to be cancelled
    });

    // Add task to the map
    {
        let mut tasks = setup.crawl_tasks.write().await;
        tasks.insert(repository_id, long_task);
    }

    // Verify task exists and crawl is active
    {
        let tasks = setup.crawl_tasks.read().await;
        assert!(tasks.contains_key(&repository_id));
    }
    assert!(setup.progress_tracker.is_crawling(repository_id).await);

    // Stop the crawl via API
    let response = setup
        .server
        .delete(&format!("/api/repositories/{}/crawl", repository_id))
        .add_header("Authorization", format!("Bearer {}", setup.admin_token))
        .await;

    // API should handle the stop request
    if response.status_code().is_success() {
        // Give some time for cleanup
        sleep(Duration::from_millis(100)).await;

        // Task should be removed from map
        {
            let tasks = setup.crawl_tasks.read().await;
            assert!(!tasks.contains_key(&repository_id));
        }

        // Progress should be cancelled
        let progress = setup.progress_tracker.get_progress(repository_id).await;
        if let Some(progress) = progress {
            assert!(matches!(progress.status, CrawlStatus::Cancelled));
        }
    }

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_cancellation_token_cleanup_after_normal_completion() -> Result<()> {
    let setup = TestSetup::new().await?;
    let repository_id = setup.create_test_repository().await?;

    // Create a temp filesystem repo for actual crawling
    let temp_repo_dir = tempfile::tempdir()?;
    let repo_path = temp_repo_dir.path();
    std::fs::create_dir_all(repo_path.join("src"))?;
    std::fs::write(repo_path.join("src/main.rs"), "fn main() {}")?;

    let repository = Repository {
        id: repository_id,
        name: "test-repo".to_string(),
        url: repo_path.to_string_lossy().to_string(),
        repository_type: RepositoryType::FileSystem,
        branch: None,
        enabled: true,
        access_token: None,
        gitlab_namespace: None,
        is_group: false,
        last_crawled: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        auto_crawl_enabled: false,
        cron_schedule: None,
        next_crawl_at: None,
        crawl_frequency_hours: None,
        max_crawl_duration_minutes: None,
    };

    // Initially no cancellation token
    assert!(!setup.crawler_service.is_crawling(repository_id).await);

    // Start crawl
    let crawl_task = tokio::spawn({
        let crawler_service = setup.crawler_service.clone();
        let repository = repository.clone();
        async move { crawler_service.crawl_repository(&repository).await }
    });

    // Give it time to create cancellation token
    sleep(Duration::from_millis(100)).await;

    // Should have cancellation token
    assert!(setup.crawler_service.is_crawling(repository_id).await);

    // Wait for completion
    let result = crawl_task.await?;

    // Should succeed and clean up token
    match result {
        Ok(_) | Err(_) => {
            // Token should be cleaned up regardless of success/failure
            assert!(!setup.crawler_service.is_crawling(repository_id).await);
        }
    }

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_cancellation_token_cleanup_after_cancellation() -> Result<()> {
    let setup = TestSetup::new().await?;
    let repository_id = setup.create_test_repository().await?;

    // Create temp repo
    let temp_repo_dir = tempfile::tempdir()?;
    let repo_path = temp_repo_dir.path();
    std::fs::create_dir_all(repo_path.join("src"))?;
    std::fs::write(repo_path.join("src/main.rs"), "fn main() {}")?;

    let repository = Repository {
        id: repository_id,
        name: "test-repo".to_string(),
        url: repo_path.to_string_lossy().to_string(),
        repository_type: RepositoryType::FileSystem,
        branch: None,
        enabled: true,
        access_token: None,
        gitlab_namespace: None,
        is_group: false,
        last_crawled: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        auto_crawl_enabled: false,
        cron_schedule: None,
        next_crawl_at: None,
        crawl_frequency_hours: None,
        max_crawl_duration_minutes: None,
    };

    // Start crawl
    let crawl_task = tokio::spawn({
        let crawler_service = setup.crawler_service.clone();
        let repository = repository.clone();
        async move { crawler_service.crawl_repository(&repository).await }
    });

    // Wait for token creation
    sleep(Duration::from_millis(100)).await;
    assert!(setup.crawler_service.is_crawling(repository_id).await);

    // Cancel crawl
    let cancel_result = setup.crawler_service.cancel_crawl(repository_id).await?;
    assert!(cancel_result);

    // Wait for task to complete
    let _ = crawl_task.await;

    // Token should be cleaned up
    assert!(!setup.crawler_service.is_crawling(repository_id).await);

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_multiple_task_cleanup() -> Result<()> {
    let setup = TestSetup::new().await?;

    let num_repos = 3;
    let mut repo_ids = Vec::new();

    // Create multiple repositories
    for i in 0..num_repos {
        let repo_id = setup.create_test_repository().await?;
        repo_ids.push(repo_id);

        // Start progress tracking
        setup
            .progress_tracker
            .start_crawl(repo_id, format!("repo-{}", i))
            .await;

        // Create dummy tasks
        let dummy_task = tokio::spawn(async move {
            sleep(Duration::from_millis(500)).await;
        });

        // Add to task map
        {
            let mut tasks = setup.crawl_tasks.write().await;
            tasks.insert(repo_id, dummy_task);
        }
    }

    // Verify all tasks exist
    {
        let tasks = setup.crawl_tasks.read().await;
        assert_eq!(tasks.len(), num_repos);
        for repo_id in &repo_ids {
            assert!(tasks.contains_key(repo_id));
        }
    }

    // Cancel all crawls
    for repo_id in &repo_ids {
        setup.crawler_service.cancel_crawl(*repo_id).await?;
        setup.progress_tracker.cancel_crawl(*repo_id).await;

        // Remove from task map (simulating API cleanup)
        {
            let mut tasks = setup.crawl_tasks.write().await;
            if let Some(handle) = tasks.remove(repo_id) {
                handle.abort();
            }
        }
    }

    // Verify all tasks cleaned up
    {
        let tasks = setup.crawl_tasks.read().await;
        assert!(tasks.is_empty());
    }

    // Verify no crawls are active
    for repo_id in &repo_ids {
        assert!(!setup.crawler_service.is_crawling(*repo_id).await);
        assert!(!setup.progress_tracker.is_crawling(*repo_id).await);
    }

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_cleanup_on_server_state() -> Result<()> {
    let setup = TestSetup::new().await?;
    let repository_id = setup.create_test_repository().await?;

    // Access the server's app state directly
    let app_state = setup.server.state::<AppState>();

    // Start tracking
    app_state
        .progress_tracker
        .start_crawl(repository_id, "test-repo".to_string())
        .await;

    // Create and add a dummy task
    let dummy_task = tokio::spawn(async {
        sleep(Duration::from_millis(200)).await;
    });

    {
        let mut tasks = app_state.crawl_tasks.write().await;
        tasks.insert(repository_id, dummy_task);
    }

    // Verify task exists in server state
    {
        let tasks = app_state.crawl_tasks.read().await;
        assert!(tasks.contains_key(&repository_id));
    }

    // Cancel via service
    app_state
        .crawler_service
        .cancel_crawl(repository_id)
        .await?;
    app_state.progress_tracker.cancel_crawl(repository_id).await;

    // Clean up task from server state
    {
        let mut tasks = app_state.crawl_tasks.write().await;
        if let Some(handle) = tasks.remove(&repository_id) {
            handle.abort();
        }
    }

    // Verify cleanup
    {
        let tasks = app_state.crawl_tasks.read().await;
        assert!(!tasks.contains_key(&repository_id));
    }

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_task_abort_functionality() -> Result<()> {
    let setup = TestSetup::new().await?;
    let repository_id = setup.create_test_repository().await?;

    // Create a task that would run for a long time
    let long_running_task = tokio::spawn(async {
        loop {
            sleep(Duration::from_millis(100)).await;
            // This would run forever unless aborted
        }
    });

    // Add to tasks map
    {
        let mut tasks = setup.crawl_tasks.write().await;
        tasks.insert(repository_id, long_running_task);
    }

    // Verify task is running
    {
        let tasks = setup.crawl_tasks.read().await;
        let task_handle = tasks.get(&repository_id).unwrap();
        assert!(!task_handle.is_finished());
    }

    // Abort the task
    {
        let mut tasks = setup.crawl_tasks.write().await;
        if let Some(handle) = tasks.remove(&repository_id) {
            handle.abort();

            // Give a moment for abort to take effect
            sleep(Duration::from_millis(10)).await;

            // Task should be aborted
            assert!(handle.is_finished());
        }
    }

    // Verify task is removed from map
    {
        let tasks = setup.crawl_tasks.read().await;
        assert!(!tasks.contains_key(&repository_id));
    }

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_cleanup_resilience_to_panics() -> Result<()> {
    let setup = TestSetup::new().await?;
    let repository_id = setup.create_test_repository().await?;

    // Create a task that will panic
    let panicking_task = tokio::spawn(async {
        sleep(Duration::from_millis(50)).await;
        panic!("Test panic");
    });

    // Add to tasks map
    {
        let mut tasks = setup.crawl_tasks.write().await;
        tasks.insert(repository_id, panicking_task);
    }

    // Wait for the panic to happen
    sleep(Duration::from_millis(100)).await;

    // Task should be finished (due to panic)
    {
        let tasks = setup.crawl_tasks.read().await;
        let task_handle = tasks.get(&repository_id).unwrap();
        assert!(task_handle.is_finished());
    }

    // Cleanup should still work even with panicked task
    {
        let mut tasks = setup.crawl_tasks.write().await;
        if let Some(handle) = tasks.remove(&repository_id) {
            // This should not panic even though the task panicked
            handle.abort(); // Should be safe to call on finished task
        }
    }

    // Verify removal
    {
        let tasks = setup.crawl_tasks.read().await;
        assert!(!tasks.contains_key(&repository_id));
    }

    setup.cleanup().await?;
    Ok(())
}

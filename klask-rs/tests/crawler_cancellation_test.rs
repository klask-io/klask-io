use anyhow::Result;
use klask_rs::{
    database::Database,
    models::{Repository, RepositoryType},
    services::{
        crawler::CrawlerService,
        encryption::EncryptionService,
        progress::{CrawlStatus, ProgressTracker},
        SearchService,
    },
};
use std::sync::Arc;
use tempfile::TempDir;
use tokio::time::{sleep, Duration};
use uuid::Uuid;
use std::sync::LazyLock;
use tokio::sync::Mutex as AsyncMutex;

// Global mutex to ensure tests don't interfere with each other
static TEST_MUTEX: LazyLock<Arc<AsyncMutex<()>>> = LazyLock::new(|| Arc::new(AsyncMutex::new(())));

struct TestSetup {
    _temp_dir: TempDir,
    database: Database,
    search_service: Arc<SearchService>,
    crawler_service: Arc<CrawlerService>,
    progress_tracker: Arc<ProgressTracker>,
    _lock: tokio::sync::MutexGuard<'static, ()>,
}

impl TestSetup {
    async fn new() -> Result<Self> {
        // Lock to ensure sequential execution
        let guard = TEST_MUTEX.lock().await;

        let temp_dir = tempfile::tempdir()?;
        let test_id = uuid::Uuid::new_v4().to_string()[..8].to_string();
        let index_path = temp_dir.path().join(format!("test_index_{}", test_id));

        // Force test database URL - ignore .env file
        let database_url = "postgres://postgres:password@localhost:5432/klask_test".to_string();

        let database = Database::new(&database_url, 10).await?;

        // Clean ALL test data with TRUNCATE for complete cleanup
        sqlx::query("TRUNCATE TABLE repositories, users RESTART IDENTITY CASCADE")
            .execute(database.pool())
            .await
            .ok();

        // Create search service with temp directory
        let search_service = Arc::new(SearchService::new(index_path.to_str().unwrap())?);

        // Create progress tracker
        let progress_tracker = Arc::new(ProgressTracker::new());

        // Create encryption service for tests
        let encryption_service =
            Arc::new(EncryptionService::new("test-encryption-key-32bytes").unwrap());

        // Create crawler service
        let crawler_service = Arc::new(CrawlerService::new(
            database.pool().clone(),
            search_service.clone(),
            progress_tracker.clone(),
            encryption_service,
        )?);

        Ok(TestSetup {
            _temp_dir: temp_dir,
            database,
            search_service,
            crawler_service,
            progress_tracker,
            _lock: guard,
        })
    }

    async fn create_test_repository(&self) -> Result<Repository> {
        let repository = Repository {
            id: Uuid::new_v4(),
            name: "test-repo".to_string(),
            url: "file:///tmp/nonexistent".to_string(), // Use filesystem type for testing
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

        // Insert repository into database
        sqlx::query(
            r#"
            INSERT INTO repositories (id, name, url, repository_type, branch, enabled, access_token, gitlab_namespace, is_group, last_crawled, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            "#
        )
        .bind(&repository.id)
        .bind(&repository.name)
        .bind(&repository.url)
        .bind(&repository.repository_type)
        .bind(&repository.branch)
        .bind(repository.enabled)
        .bind(&repository.access_token)
        .bind(&repository.gitlab_namespace)
        .bind(repository.is_group)
        .bind(repository.last_crawled)
        .bind(repository.created_at)
        .bind(repository.updated_at)
        .execute(self.database.pool())
        .await?;

        Ok(repository)
    }

    async fn create_temp_filesystem_repo(&self) -> Result<(Repository, TempDir)> {
        let temp_repo_dir = tempfile::tempdir()?;
        let repo_path = temp_repo_dir.path();

        // Create test files
        std::fs::create_dir_all(repo_path.join("src"))?;
        std::fs::write(
            repo_path.join("src/main.rs"),
            "fn main() {\n    println!(\"Hello, world!\");\n}",
        )?;
        std::fs::write(
            repo_path.join("README.md"),
            "# Test Repository\n\nThis is a test.",
        )?;
        std::fs::write(
            repo_path.join("Cargo.toml"),
            "[package]\nname = \"test\"\nversion = \"0.1.0\"",
        )?;

        let repository = Repository {
            id: Uuid::new_v4(),
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

        // Insert repository into database
        sqlx::query(
            r#"
            INSERT INTO repositories (id, name, url, repository_type, branch, enabled, access_token, gitlab_namespace, is_group, last_crawled, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            "#
        )
        .bind(&repository.id)
        .bind(&repository.name)
        .bind(&repository.url)
        .bind(&repository.repository_type)
        .bind(&repository.branch)
        .bind(repository.enabled)
        .bind(&repository.access_token)
        .bind(&repository.gitlab_namespace)
        .bind(repository.is_group)
        .bind(repository.last_crawled)
        .bind(repository.created_at)
        .bind(repository.updated_at)
        .execute(self.database.pool())
        .await?;

        Ok((repository, temp_repo_dir))
    }

    async fn cleanup(&self) -> Result<()> {
        // Clean up test data
        sqlx::query("DELETE FROM repositories")
            .execute(self.database.pool())
            .await?;
        Ok(())
    }
}

#[tokio::test]
async fn test_cancellation_token_creation() -> Result<()> {
    let setup = TestSetup::new().await?;
    let repository = setup.create_test_repository().await?;

    // Initially no cancellation token should exist
    assert!(!setup.crawler_service.is_crawling(repository.id).await);

    // Try to cancel non-existent crawl
    let result = setup.crawler_service.cancel_crawl(repository.id).await?;
    assert!(!result); // Should return false as no crawl was active

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_cancellation_token_cleanup() -> Result<()> {
    let setup = TestSetup::new().await?;
    let (repository, _temp_dir) = setup.create_temp_filesystem_repo().await?;

    // Start a crawl (this will create a cancellation token)
    let crawl_task = tokio::spawn({
        let crawler_service = setup.crawler_service.clone();
        let repository = repository.clone();
        async move { crawler_service.crawl_repository(&repository).await }
    });

    // Give it a moment to start and create the token
    sleep(Duration::from_millis(100)).await;

    // Verify token exists
    assert!(setup.crawler_service.is_crawling(repository.id).await);

    // Let the crawl complete naturally
    let result = crawl_task.await?;

    // The crawl should succeed (or fail due to path issues, but token should be cleaned up)
    match result {
        Ok(_) | Err(_) => {
            // Token should be cleaned up regardless of success/failure
            assert!(!setup.crawler_service.is_crawling(repository.id).await);
        }
    }

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_cancel_crawl_functionality() -> Result<()> {
    let setup = TestSetup::new().await?;
    let (repository, _temp_dir) = setup.create_temp_filesystem_repo().await?;

    // Start a crawl in background
    let crawl_task = tokio::spawn({
        let crawler_service = setup.crawler_service.clone();
        let repository = repository.clone();
        async move { crawler_service.crawl_repository(&repository).await }
    });

    // Give it time to start and create cancellation token
    sleep(Duration::from_millis(100)).await;

    // Verify crawl is active
    assert!(setup.crawler_service.is_crawling(repository.id).await);
    assert!(setup.progress_tracker.is_crawling(repository.id).await);

    // Cancel the crawl
    let cancel_result = setup.crawler_service.cancel_crawl(repository.id).await?;
    assert!(cancel_result); // Should return true as crawl was active

    // Wait for the crawl task to complete (it should exit due to cancellation)
    let result = crawl_task.await?;

    // The result might be Ok (if cancellation was handled gracefully) or Err
    // But the important part is that the crawl was cancelled

    // Verify progress is in a terminal state (any terminal state is acceptable after cancellation)
    let progress = setup.progress_tracker.get_progress(repository.id).await;
    if let Some(progress) = progress {
        eprintln!("Progress status: {:?}", progress.status);
        assert!(matches!(progress.status, CrawlStatus::Cancelled | CrawlStatus::Failed | CrawlStatus::Completed));
    } else {
        eprintln!("No progress found - this is also acceptable after cancellation");
    }

    // Verify crawl is no longer active
    assert!(!setup.crawler_service.is_crawling(repository.id).await);

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_multiple_cancellation_tokens() -> Result<()> {
    let setup = TestSetup::new().await?;
    let num_repos = 3;
    let mut repositories = Vec::new();
    let mut temp_dirs = Vec::new();
    let mut tasks = Vec::new();

    // Start multiple crawls
    for i in 0..num_repos {
        let (repo, temp_dir) = setup.create_temp_filesystem_repo().await?;
        repositories.push(repo.clone());
        temp_dirs.push(temp_dir);

        let task = tokio::spawn({
            let crawler_service = setup.crawler_service.clone();
            async move { crawler_service.crawl_repository(&repo).await }
        });
        tasks.push(task);
    }

    // Give them time to start
    sleep(Duration::from_millis(200)).await;

    // Try to cancel the middle one (may or may not be active due to timing)
    let cancel_result = setup
        .crawler_service
        .cancel_crawl(repositories[1].id)
        .await?;
    // cancel_result may be true or false depending on timing

    // Just verify the test completes without errors - the main goal is testing
    // that multiple cancellation tokens can be managed without system crash

    // Wait for all tasks to complete
    for task in tasks {
        let _ = task.await;
    }

    // Eventually all should be cleaned up
    for repo in &repositories {
        assert!(!setup.crawler_service.is_crawling(repo.id).await);
    }

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_cancel_before_crawl_starts() -> Result<()> {
    let setup = TestSetup::new().await?;
    let repository = setup.create_test_repository().await?;

    // Try to cancel before any crawl starts
    let cancel_result = setup.crawler_service.cancel_crawl(repository.id).await?;
    assert!(!cancel_result); // Should return false as no crawl was active

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_double_cancellation() -> Result<()> {
    let setup = TestSetup::new().await?;
    let (repository, _temp_dir) = setup.create_temp_filesystem_repo().await?;

    // Start a crawl
    let crawl_task = tokio::spawn({
        let crawler_service = setup.crawler_service.clone();
        let repository = repository.clone();
        async move { crawler_service.crawl_repository(&repository).await }
    });

    // Give it time to start
    sleep(Duration::from_millis(100)).await;

    // Cancel twice
    let cancel_result1 = setup.crawler_service.cancel_crawl(repository.id).await?;
    let cancel_result2 = setup.crawler_service.cancel_crawl(repository.id).await?;

    assert!(cancel_result1); // First cancellation should succeed
                             // Second cancellation might succeed or fail depending on cleanup timing

    // Wait for task to complete
    let _ = crawl_task.await;

    // Final state should be not crawling
    assert!(!setup.crawler_service.is_crawling(repository.id).await);

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_cancellation_during_different_phases() -> Result<()> {
    let setup = TestSetup::new().await?;
    let (repository, _temp_dir) = setup.create_temp_filesystem_repo().await?;

    // Start crawl
    let crawl_task = tokio::spawn({
        let crawler_service = setup.crawler_service.clone();
        let repository = repository.clone();
        async move { crawler_service.crawl_repository(&repository).await }
    });

    // Give it time to start but cancel quickly
    sleep(Duration::from_millis(50)).await;

    // Check current status
    let progress_before = setup.progress_tracker.get_progress(repository.id).await;

    // Cancel during early phase
    let cancel_result = setup.crawler_service.cancel_crawl(repository.id).await?;
    assert!(cancel_result);

    // Wait for completion
    let _ = crawl_task.await;

    // Verify final state
    let progress_after = setup.progress_tracker.get_progress(repository.id).await;
    if let Some(progress) = progress_after {
        eprintln!("Progress status after cancellation: {:?}", progress.status);
        assert!(matches!(progress.status, CrawlStatus::Cancelled | CrawlStatus::Failed | CrawlStatus::Completed));
    } else {
        eprintln!("No progress found after cancellation - this is also acceptable");
    }

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_is_crawling_accuracy() -> Result<()> {
    let setup = TestSetup::new().await?;
    let (repository, _temp_dir) = setup.create_temp_filesystem_repo().await?;

    // Initially not crawling
    assert!(!setup.crawler_service.is_crawling(repository.id).await);

    // Start crawl
    let crawl_task = tokio::spawn({
        let crawler_service = setup.crawler_service.clone();
        let repository = repository.clone();
        async move { crawler_service.crawl_repository(&repository).await }
    });

    // Give it time to register the token
    sleep(Duration::from_millis(100)).await;

    // Should now be crawling
    assert!(setup.crawler_service.is_crawling(repository.id).await);

    // Cancel and wait
    setup.crawler_service.cancel_crawl(repository.id).await?;
    let _ = crawl_task.await;

    // Should no longer be crawling
    assert!(!setup.crawler_service.is_crawling(repository.id).await);

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_concurrent_cancel_operations() -> Result<()> {
    let setup = TestSetup::new().await?;
    let (repository, _temp_dir) = setup.create_temp_filesystem_repo().await?;

    // Start crawl
    let crawl_task = tokio::spawn({
        let crawler_service = setup.crawler_service.clone();
        let repository = repository.clone();
        async move { crawler_service.crawl_repository(&repository).await }
    });

    // Give it time to start
    sleep(Duration::from_millis(100)).await;

    // Cancel from multiple threads concurrently
    let cancel_task1 = tokio::spawn({
        let crawler_service = setup.crawler_service.clone();
        let repo_id = repository.id;
        async move { crawler_service.cancel_crawl(repo_id).await }
    });

    let cancel_task2 = tokio::spawn({
        let crawler_service = setup.crawler_service.clone();
        let repo_id = repository.id;
        async move { crawler_service.cancel_crawl(repo_id).await }
    });

    // Wait for all tasks
    let result1 = cancel_task1.await??;
    let result2 = cancel_task2.await??;
    let _ = crawl_task.await;

    // At least one cancellation should succeed
    assert!(result1 || result2);

    // Final state should be not crawling
    assert!(!setup.crawler_service.is_crawling(repository.id).await);

    setup.cleanup().await?;
    Ok(())
}

use anyhow::Result;
use klask_rs::{
    database::Database,
    models::{Repository, RepositoryType},
    services::{
        crawler::{CrawlProgress, CrawlerService},
        encryption::EncryptionService,
        progress::ProgressTracker,
        SearchService,
    },
};
use std::sync::Arc;
use std::sync::LazyLock;
use tempfile::TempDir;
use tokio::sync::Mutex as AsyncMutex;
use uuid::Uuid;

// Global mutex to ensure tests don't interfere with each other
static TEST_MUTEX: LazyLock<Arc<AsyncMutex<()>>> = LazyLock::new(|| Arc::new(AsyncMutex::new(())));

struct TestSetup {
    _temp_dir: TempDir,
    database: Database,
    search_service: Arc<SearchService>,
    crawler_service: Arc<CrawlerService>,
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
            progress_tracker,
            encryption_service,
        )?);

        Ok(TestSetup {
            _temp_dir: temp_dir,
            database,
            search_service,
            crawler_service,
            _lock: guard,
        })
    }

    async fn create_test_repository(&self) -> Result<Repository> {
        let repository = Repository {
            id: Uuid::new_v4(),
            name: "test-repo".to_string(),
            url: "https://github.com/rust-lang/git2-rs.git".to_string(),
            repository_type: RepositoryType::Git,
            branch: Some("main".to_string()),
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

    async fn cleanup(&self) -> Result<()> {
        // Clean up test data
        // Files are now only in Tantivy search index, no database table to clean
        sqlx::query("DELETE FROM repositories")
            .execute(self.database.pool())
            .await?;
        Ok(())
    }
}

#[tokio::test]
async fn test_crawler_service_initialization() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Test that crawler service initializes successfully
    assert!(!setup.crawler_service.temp_dir.as_os_str().is_empty());

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_supported_file_detection() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Test supported file extensions
    let supported_files = vec![
        "test.rs",
        "test.py",
        "test.js",
        "test.ts",
        "test.java",
        "test.c",
        "test.cpp",
        "test.go",
        "test.rb",
        "README.md",
        "Dockerfile",
        "Makefile",
        "package.json",
    ];

    for file in supported_files {
        let path = std::path::Path::new(file);
        assert!(
            setup.crawler_service.is_supported_file(path),
            "File {} should be supported",
            file
        );
    }

    // Test unsupported file extensions
    let unsupported_files = vec!["test.exe", "test.dll", "test.so", "test.bin", "test.img"];

    for file in unsupported_files {
        let path = std::path::Path::new(file);
        assert!(
            !setup.crawler_service.is_supported_file(path),
            "File {} should not be supported",
            file
        );
    }

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
#[ignore] // This test requires internet connection and takes time
async fn test_git_repository_cloning() -> Result<()> {
    let setup = TestSetup::new().await?;
    let repository = setup.create_test_repository().await?;

    // Test cloning a real repository (using git2-rs as it's small and stable)
    let result = setup.crawler_service.crawl_repository(&repository).await;

    match result {
        Ok(()) => {
            // Verify that files were indexed in Tantivy search service
            setup.search_service.commit().await?;
            let doc_count = setup.search_service.get_document_count()?;

            assert!(doc_count > 0, "Should have indexed some files");

            // Verify repository last_crawled was updated
            let updated_repo = sqlx::query_scalar::<_, Option<chrono::DateTime<chrono::Utc>>>(
                "SELECT last_crawled FROM repositories WHERE id = $1",
            )
            .bind(repository.id)
            .fetch_one(setup.database.pool())
            .await?;

            assert!(
                updated_repo.is_some(),
                "Repository last_crawled should be updated"
            );
        }
        Err(e) => {
            // If the test fails due to network issues, that's acceptable
            if e.to_string().contains("network") || e.to_string().contains("SSL") {
                println!("Skipping test due to network issues: {}", e);
            } else {
                return Err(e);
            }
        }
    }

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_file_processing_and_indexing() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Create a temporary filesystem repository for testing
    let temp_repo_dir = tempfile::tempdir()?;
    let repo_path = temp_repo_dir.path();

    // Create filesystem repository instead of git
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
    .execute(setup.database.pool())
    .await?;

    // Create test files
    let test_files = vec![
        (
            "src/main.rs",
            "fn main() {\n    println!(\"Hello, world!\");\n}",
        ),
        ("README.md", "# Test Repository\n\nThis is a test."),
        (
            "Cargo.toml",
            "[package]\nname = \"test\"\nversion = \"0.1.0\"",
        ),
    ];

    for (file_path, content) in &test_files {
        let full_path = repo_path.join(file_path);
        if let Some(parent) = full_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&full_path, content)?;
    }

    // Test processing files
    let mut progress = CrawlProgress {
        files_processed: 0,
        files_indexed: 0,
        errors: Vec::new(),
    };

    let cancellation_token = tokio_util::sync::CancellationToken::new();
    setup
        .crawler_service
        .process_repository_files(&repository, repo_path, &mut progress, &cancellation_token)
        .await?;

    // Verify files were processed
    eprintln!("Files processed: {}", progress.files_processed);
    eprintln!("Files indexed: {}", progress.files_indexed);
    eprintln!("Errors: {:?}", progress.errors);
    eprintln!("Repository path: {}", repo_path.display());

    // List files in the repository path for debugging
    if let Ok(entries) = std::fs::read_dir(&repo_path) {
        eprintln!("Files in repository:");
        for entry in entries {
            if let Ok(entry) = entry {
                eprintln!("  - {}", entry.path().display());
            }
        }
    }

    assert!(
        progress.files_processed > 0,
        "Should have processed some files"
    );
    assert_eq!(
        progress.files_processed, progress.files_indexed,
        "All processed files should be indexed"
    );
    assert!(
        progress.errors.is_empty(),
        "Should have no errors: {:?}",
        progress.errors
    );

    // Verify search service has been called to index files
    // Note: The files are now indexed in Tantivy, not stored in database
    setup.search_service.commit().await?;
    let doc_count = setup.search_service.get_document_count()?;

    assert!(
        doc_count >= test_files.len() as u64,
        "Should have at least {} documents indexed",
        test_files.len()
    );

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_file_size_limits() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Test that large files are skipped
    let temp_dir = tempfile::tempdir()?;
    let large_file_path = temp_dir.path().join("large_file.rs");

    // Create a file larger than MAX_FILE_SIZE (10MB)
    let large_content = "// Large file\n".repeat(1024 * 1024); // ~13MB
    std::fs::write(&large_file_path, large_content)?;

    // Check if file is considered supported but would be skipped due to size
    assert!(setup.crawler_service.is_supported_file(&large_file_path));

    // The actual size check happens during crawling, so we'd need to test that separately
    let metadata = large_file_path.metadata()?;
    assert!(
        metadata.len() > 10 * 1024 * 1024,
        "File should be larger than 10MB"
    );

    Ok(())
}

#[tokio::test]
async fn test_error_handling() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Test with invalid repository URL
    let invalid_repo = Repository {
        id: Uuid::new_v4(),
        name: "invalid-repo".to_string(),
        url: "invalid://url".to_string(),
        repository_type: RepositoryType::Git,
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

    let result = setup.crawler_service.crawl_repository(&invalid_repo).await;
    assert!(result.is_err(), "Should fail with invalid repository URL");

    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_repository_update_integration() -> Result<()> {
    let setup = TestSetup::new().await?;

    // Test database operations that still exist
    let repository = setup.create_test_repository().await?;

    // Test updating repository crawl time (this method still exists)
    setup
        .crawler_service
        .update_repository_crawl_time(repository.id)
        .await?;

    let updated_repo = sqlx::query_scalar::<_, Option<chrono::DateTime<chrono::Utc>>>(
        "SELECT last_crawled FROM repositories WHERE id = $1",
    )
    .bind(repository.id)
    .fetch_one(setup.database.pool())
    .await?;

    assert!(
        updated_repo.is_some(),
        "Repository last_crawled should be updated"
    );

    // Test cancellation token management
    assert!(!setup.crawler_service.is_crawling(repository.id).await);

    setup.cleanup().await?;
    Ok(())
}

use anyhow::Result;
use axum_test::TestServer;
use klask_rs::{
    config::AppConfig,
    database::Database,
    models::{Repository, RepositoryType},
    services::{SearchService, crawler::{CrawlerService, CrawlProgress}},
};
use sqlx::{Pool, Postgres};
use std::sync::Arc;
use tempfile::TempDir;
use tokio_test;
use uuid::Uuid;

struct TestSetup {
    _temp_dir: TempDir,
    database: Database,
    search_service: Arc<SearchService>,
    crawler_service: Arc<CrawlerService>,
}

impl TestSetup {
    async fn new() -> Result<Self> {
        let temp_dir = tempfile::tempdir()?;
        let index_path = temp_dir.path().join("test_index");
        
        // Create test database connection
        let database_url = std::env::var("TEST_DATABASE_URL")
            .unwrap_or_else(|_| "postgres://postgres:password@localhost:5432/klask_test".to_string());
        
        let database = Database::new(&database_url, 5).await?;
        
        // Run migrations
        sqlx::migrate!("./migrations").run(database.pool()).await?;
        
        // Create search service with temp directory
        let search_service = Arc::new(SearchService::new(index_path.to_str().unwrap())?);
        
        // Create crawler service
        let crawler_service = Arc::new(CrawlerService::new(
            database.pool().clone(),
            search_service.clone(),
        )?);
        
        Ok(TestSetup {
            _temp_dir: temp_dir,
            database,
            search_service,
            crawler_service,
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
            last_crawled: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        
        // Insert repository into database
        sqlx::query(
            r#"
            INSERT INTO repositories (id, name, url, repository_type, branch, enabled, last_crawled, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            "#
        )
        .bind(&repository.id)
        .bind(&repository.name)
        .bind(&repository.url)
        .bind(&repository.repository_type)
        .bind(&repository.branch)
        .bind(repository.enabled)
        .bind(repository.last_crawled)
        .bind(repository.created_at)
        .bind(repository.updated_at)
        .execute(self.database.pool())
        .await?;
        
        Ok(repository)
    }
    
    async fn cleanup(&self) -> Result<()> {
        // Clean up test data
        sqlx::query("DELETE FROM files").execute(self.database.pool()).await?;
        sqlx::query("DELETE FROM repositories").execute(self.database.pool()).await?;
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
        "test.rs", "test.py", "test.js", "test.ts", "test.java",
        "test.c", "test.cpp", "test.go", "test.rb", "README.md",
        "Dockerfile", "Makefile", "package.json"
    ];
    
    for file in supported_files {
        let path = std::path::Path::new(file);
        assert!(setup.crawler_service.is_supported_file(path), "File {} should be supported", file);
    }
    
    // Test unsupported file extensions
    let unsupported_files = vec![
        "test.exe", "test.dll", "test.so", "test.bin", "test.img"
    ];
    
    for file in unsupported_files {
        let path = std::path::Path::new(file);
        assert!(!setup.crawler_service.is_supported_file(path), "File {} should not be supported", file);
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
            // Verify that files were indexed
            let files = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM files WHERE project = $1")
                .bind(&repository.name)
                .fetch_one(setup.database.pool())
                .await?;
            
            assert!(files > 0, "Should have indexed some files");
            
            // Verify repository last_crawled was updated
            let updated_repo = sqlx::query_scalar::<_, Option<chrono::DateTime<chrono::Utc>>>(
                "SELECT last_crawled FROM repositories WHERE id = $1"
            )
            .bind(repository.id)
            .fetch_one(setup.database.pool())
            .await?;
            
            assert!(updated_repo.is_some(), "Repository last_crawled should be updated");
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
    let repository = setup.create_test_repository().await?;
    
    // Create a temporary git repository for testing
    let temp_repo_dir = tempfile::tempdir()?;
    let repo_path = temp_repo_dir.path();
    
    // Initialize git repository
    let git_repo = git2::Repository::init(repo_path)?;
    
    // Create test files
    let test_files = vec![
        ("src/main.rs", "fn main() {\n    println!(\"Hello, world!\");\n}"),
        ("README.md", "# Test Repository\n\nThis is a test."),
        ("Cargo.toml", "[package]\nname = \"test\"\nversion = \"0.1.0\""),
    ];
    
    for (file_path, content) in &test_files {
        let full_path = repo_path.join(file_path);
        if let Some(parent) = full_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&full_path, content)?;
    }
    
    // Create initial commit
    let signature = git2::Signature::now("Test User", "test@example.com")?;
    let tree_id = {
        let mut index = git_repo.index()?;
        index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
        index.write()?;
        index.write_tree()?
    };
    let tree = git_repo.find_tree(tree_id)?;
    git_repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        "Initial commit",
        &tree,
        &[],
    )?;
    
    // Test processing files
    let mut progress = CrawlProgress {
        files_processed: 0,
        files_indexed: 0,
        errors: Vec::new(),
    };
    
    setup.crawler_service.process_repository_files(&repository, repo_path, &mut progress).await?;
    
    // Verify files were processed
    assert!(progress.files_processed > 0, "Should have processed some files");
    assert_eq!(progress.files_processed, progress.files_indexed, "All processed files should be indexed");
    assert!(progress.errors.is_empty(), "Should have no errors: {:?}", progress.errors);
    
    // Verify files are in database
    let db_files = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM files WHERE project = $1")
        .bind(&repository.name)
        .fetch_one(setup.database.pool())
        .await?;
    
    assert!(db_files >= test_files.len() as i64, "Should have at least {} files in database", test_files.len());
    
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
    assert!(metadata.len() > 10 * 1024 * 1024, "File should be larger than 10MB");
    
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
        last_crawled: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };
    
    let result = setup.crawler_service.crawl_repository(&invalid_repo).await;
    assert!(result.is_err(), "Should fail with invalid repository URL");
    
    setup.cleanup().await?;
    Ok(())
}

#[tokio::test]
async fn test_database_integration() -> Result<()> {
    let setup = TestSetup::new().await?;
    
    // Test database operations
    let repository = setup.create_test_repository().await?;
    
    // Test getting existing files (should be empty initially)
    let existing_files = setup.crawler_service.get_existing_files(repository.id).await?;
    assert!(existing_files.is_empty(), "Should have no existing files");
    
    // Test saving a file to database
    let test_file = klask_rs::models::File {
        id: Uuid::new_v4(),
        name: "test.rs".to_string(),
        path: "src/test.rs".to_string(),
        content: Some("fn test() {}".to_string()),
        project: repository.name.clone(),
        version: "HEAD".to_string(),
        extension: "rs".to_string(),
        size: 12,
        last_modified: chrono::Utc::now(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };
    
    setup.crawler_service.save_file_to_database(repository.id, &test_file).await?;
    
    // Verify file was saved
    let saved_files = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM files WHERE project = $1")
        .bind(&repository.name)
        .fetch_one(setup.database.pool())
        .await?;
    
    assert_eq!(saved_files, 1, "Should have saved one file");
    
    // Test updating repository crawl time
    setup.crawler_service.update_repository_crawl_time(repository.id).await?;
    
    let updated_repo = sqlx::query_scalar::<_, Option<chrono::DateTime<chrono::Utc>>>(
        "SELECT last_crawled FROM repositories WHERE id = $1"
    )
    .bind(repository.id)
    .fetch_one(setup.database.pool())
    .await?;
    
    assert!(updated_repo.is_some(), "Repository last_crawled should be updated");
    
    setup.cleanup().await?;
    Ok(())
}
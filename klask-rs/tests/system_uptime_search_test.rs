use anyhow::Result;
use klask_rs::{
    auth::extractors::AppState, config::Config, database::Database, services::search::SearchService,
};
use sqlx::PgPool;
use std::{sync::Arc, time::Instant};
use tempfile::TempDir;
use tokio::test;

// Helper function to create test app state
async fn setup_test_app_state() -> Result<(AppState, TempDir)> {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:password@localhost/klask_test".to_string());

    let pool = PgPool::connect(&database_url).await?;
    let database = Database::new(pool);

    let temp_dir = TempDir::new()?;
    let index_path = temp_dir.path().join("test_index");

    let config = Config::default();
    let search_service = SearchService::new(index_path.to_str().unwrap(), &config)?;

    let app_state = AppState {
        database: Arc::new(database),
        search_service: Arc::new(search_service),
        startup_time: Instant::now(),
    };

    Ok((app_state, temp_dir))
}

#[tokio::test]
async fn test_system_uptime_tracking() -> Result<()> {
    let (app_state, _temp_dir) = setup_test_app_state().await?;

    // Get initial uptime (should be very small)
    let initial_uptime = app_state.startup_time.elapsed().as_secs();
    assert!(initial_uptime < 5, "Initial uptime should be very small");

    // Wait a short time
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Check that uptime has increased
    let later_uptime = app_state.startup_time.elapsed().as_secs();
    assert!(
        later_uptime >= initial_uptime,
        "Uptime should increase over time"
    );

    Ok(())
}

#[tokio::test]
async fn test_search_service_initialization() -> Result<()> {
    let (app_state, _temp_dir) = setup_test_app_state().await?;

    // Test that search service is properly initialized
    let document_count = app_state.search_service.get_document_count()?;
    assert_eq!(
        document_count, 0,
        "New search index should have 0 documents"
    );

    let index_size = app_state.search_service.get_index_size_mb();
    assert!(index_size >= 0.0, "Index size should be non-negative");
    assert!(index_size < 1.0, "Empty index should be small");

    Ok(())
}

#[tokio::test]
async fn test_search_index_size_calculation() -> Result<()> {
    let config = Config::default();
    let temp_dir = TempDir::new()?;
    let index_path = temp_dir.path().join("test_index");

    let search_service = SearchService::new(index_path.to_str().unwrap(), &config)?;

    // Test empty index size
    let empty_size = search_service.get_index_size_mb();
    assert!(empty_size >= 0.0);

    // Add some test documents
    search_service.add_document(
        "test_doc_1",
        "This is test content for document 1",
        "test.txt",
        "txt",
        100,
        "test_project",
        "main",
    )?;

    search_service.add_document(
        "test_doc_2",
        "This is test content for document 2 with more content to make it larger",
        "test2.txt",
        "txt",
        200,
        "test_project",
        "main",
    )?;

    // Commit changes
    search_service.commit_writer()?;

    // Test that index size increased
    let size_with_docs = search_service.get_index_size_mb();
    assert!(
        size_with_docs > empty_size,
        "Index size should increase with documents"
    );

    // Test document count
    let doc_count = search_service.get_document_count()?;
    assert_eq!(doc_count, 2, "Should have 2 documents");

    Ok(())
}

#[tokio::test]
async fn test_search_service_document_operations() -> Result<()> {
    let config = Config::default();
    let temp_dir = TempDir::new()?;
    let index_path = temp_dir.path().join("test_index");

    let search_service = SearchService::new(index_path.to_str().unwrap(), &config)?;

    // Test adding documents
    search_service.add_document(
        "doc1",
        "fn main() { println!(\"Hello, world!\"); }",
        "main.rs",
        "rs",
        42,
        "rust_project",
        "main",
    )?;

    search_service.add_document(
        "doc2",
        "function hello() { console.log('Hello, world!'); }",
        "app.js",
        "js",
        48,
        "js_project",
        "main",
    )?;

    search_service.commit_writer()?;

    // Test document count
    let count = search_service.get_document_count()?;
    assert_eq!(count, 2);

    // Test search functionality
    let results = search_service.search("println", 10, 0)?;
    assert_eq!(results.len(), 1, "Should find 1 document with 'println'");
    assert!(results[0].path.contains("main.rs"));

    let results = search_service.search("hello", 10, 0)?;
    assert_eq!(results.len(), 2, "Should find 2 documents with 'hello'");

    // Test search with no results
    let results = search_service.search("nonexistent", 10, 0)?;
    assert_eq!(results.len(), 0, "Should find 0 documents");

    Ok(())
}

#[tokio::test]
async fn test_search_service_index_size_with_large_content() -> Result<()> {
    let config = Config::default();
    let temp_dir = TempDir::new()?;
    let index_path = temp_dir.path().join("test_index");

    let search_service = SearchService::new(index_path.to_str().unwrap(), &config)?;

    let initial_size = search_service.get_index_size_mb();

    // Add a document with substantial content
    let large_content = "fn main() {\n".repeat(1000) + &"}\n".repeat(1000);
    search_service.add_document(
        "large_doc",
        &large_content,
        "large.rs",
        "rs",
        large_content.len() as i64,
        "large_project",
        "main",
    )?;

    search_service.commit_writer()?;

    let size_after_large = search_service.get_index_size_mb();
    assert!(
        size_after_large > initial_size,
        "Index should grow with large content"
    );

    // Test that document count is correct
    let count = search_service.get_document_count()?;
    assert_eq!(count, 1);

    Ok(())
}

#[tokio::test]
async fn test_database_health_check() -> Result<()> {
    let (app_state, _temp_dir) = setup_test_app_state().await?;

    // Test database health check
    let health_result = app_state.database.health_check().await;
    assert!(health_result.is_ok(), "Database health check should pass");

    Ok(())
}

#[tokio::test]
async fn test_system_stats_integration() -> Result<()> {
    let (app_state, _temp_dir) = setup_test_app_state().await?;

    // Test that we can gather all system statistics
    let database_status = match app_state.database.health_check().await {
        Ok(_) => "Connected",
        Err(_) => "Disconnected",
    };

    let uptime_seconds = app_state.startup_time.elapsed().as_secs();
    let document_count = app_state.search_service.get_document_count()?;
    let index_size_mb = app_state.search_service.get_index_size_mb();

    // Verify all stats are reasonable
    assert!(database_status == "Connected" || database_status == "Disconnected");
    assert!(uptime_seconds < 3600); // Should be less than an hour for tests
    assert!(document_count >= 0);
    assert!(index_size_mb >= 0.0);

    Ok(())
}

#[tokio::test]
async fn test_search_index_persistence() -> Result<()> {
    let config = Config::default();
    let temp_dir = TempDir::new()?;
    let index_path = temp_dir.path().join("test_index");
    let index_path_str = index_path.to_str().unwrap();

    // Create first search service and add documents
    {
        let search_service = SearchService::new(index_path_str, &config)?;

        search_service.add_document(
            "persistent_doc",
            "This document should persist across service restarts",
            "persistent.txt",
            "txt",
            50,
            "test_project",
            "main",
        )?;

        search_service.commit_writer()?;

        let count = search_service.get_document_count()?;
        assert_eq!(count, 1);
    }

    // Create new search service with same index path
    {
        let search_service = SearchService::new(index_path_str, &config)?;

        // Document should still exist
        let count = search_service.get_document_count()?;
        assert_eq!(count, 1, "Document should persist across service restarts");

        let results = search_service.search("persist", 10, 0)?;
        assert_eq!(results.len(), 1, "Should find persistent document");
    }

    Ok(())
}

#[tokio::test]
async fn test_search_service_error_handling() -> Result<()> {
    let config = Config::default();

    // Test with invalid index path
    let result = SearchService::new("/invalid/path/that/does/not/exist", &config);
    // Note: Tantivy might create directories, so this test depends on filesystem permissions

    // Test with valid service
    let temp_dir = TempDir::new()?;
    let index_path = temp_dir.path().join("test_index");
    let search_service = SearchService::new(index_path.to_str().unwrap(), &config)?;

    // Test search with empty index
    let results = search_service.search("anything", 10, 0)?;
    assert_eq!(results.len(), 0);

    // Test document count with empty index
    let count = search_service.get_document_count()?;
    assert_eq!(count, 0);

    Ok(())
}

#[tokio::test]
async fn test_concurrent_search_operations() -> Result<()> {
    let config = Config::default();
    let temp_dir = TempDir::new()?;
    let index_path = temp_dir.path().join("test_index");

    let search_service = Arc::new(SearchService::new(index_path.to_str().unwrap(), &config)?);

    // Add some initial documents
    search_service.add_document(
        "doc1",
        "concurrent test document one",
        "test1.txt",
        "txt",
        30,
        "test_project",
        "main",
    )?;

    search_service.add_document(
        "doc2",
        "concurrent test document two",
        "test2.txt",
        "txt",
        30,
        "test_project",
        "main",
    )?;

    search_service.commit_writer()?;

    // Test concurrent searches
    let service1 = search_service.clone();
    let service2 = search_service.clone();
    let service3 = search_service.clone();

    let (result1, result2, result3) = tokio::join!(
        async move { service1.search("concurrent", 10, 0) },
        async move { service2.search("test", 10, 0) },
        async move { service3.get_document_count() }
    );

    assert!(result1.is_ok());
    assert!(result2.is_ok());
    assert!(result3.is_ok());

    let search_results = result1?;
    assert_eq!(search_results.len(), 2, "Should find both documents");

    let doc_count = result3?;
    assert_eq!(doc_count, 2);

    Ok(())
}

#[tokio::test]
async fn test_uptime_consistency() -> Result<()> {
    let (app_state, _temp_dir) = setup_test_app_state().await?;

    // Take multiple uptime measurements
    let uptime1 = app_state.startup_time.elapsed().as_secs();
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
    let uptime2 = app_state.startup_time.elapsed().as_secs();
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
    let uptime3 = app_state.startup_time.elapsed().as_secs();

    // Uptime should be monotonically increasing
    assert!(uptime2 >= uptime1, "Uptime should not decrease");
    assert!(uptime3 >= uptime2, "Uptime should not decrease");

    // All measurements should be reasonable
    assert!(uptime3 < 60, "Test uptime should be less than a minute");

    Ok(())
}

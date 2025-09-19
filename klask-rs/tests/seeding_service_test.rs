use anyhow::Result;
use chrono::{Duration, Utc};
use klask_rs::services::seeding::{SeedingService, SeedingStats};
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tokio::test;
use uuid::Uuid;

// Helper function to create a test database pool
async fn setup_test_db() -> Result<PgPool> {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:password@localhost/klask_test".to_string());

    let pool = PgPool::connect(&database_url).await?;

    // Run migrations if needed
    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}

// Helper function to clean up test data
async fn cleanup_test_data(pool: &PgPool) -> Result<()> {
    // Clean in reverse order due to foreign key constraints
    sqlx::query("DELETE FROM files").execute(pool).await?;
    sqlx::query("DELETE FROM repositories")
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM users").execute(pool).await?;
    Ok(())
}

#[tokio::test]
async fn test_seeding_service_creation() -> Result<()> {
    let pool = setup_test_db().await?;
    let seeding_service = SeedingService::new(pool.clone());

    // Should be able to create seeding service without issues
    assert!(std::ptr::eq(&seeding_service.pool, &pool));

    Ok(())
}

#[tokio::test]
async fn test_seed_all_creates_data() -> Result<()> {
    let pool = setup_test_db().await?;
    cleanup_test_data(&pool).await?;

    let seeding_service = SeedingService::new(pool.clone());

    // Get initial counts
    let initial_stats = seeding_service.get_stats().await?;
    assert_eq!(initial_stats.users, 0);
    assert_eq!(initial_stats.repositories, 0);
    assert_eq!(initial_stats.files, 0);

    // Seed all data
    seeding_service.seed_all().await?;

    // Check that data was created
    let stats = seeding_service.get_stats().await?;
    assert!(stats.users > 0, "Expected users to be created");
    assert!(
        stats.repositories > 0,
        "Expected repositories to be created"
    );
    assert!(stats.files > 0, "Expected files to be created");

    // Verify specific counts based on seed data
    assert_eq!(stats.users, 5, "Expected 5 seed users");
    assert_eq!(stats.repositories, 5, "Expected 5 seed repositories");
    // Each repository should have 10 files (from templates)
    assert_eq!(
        stats.files, 50,
        "Expected 50 seed files (10 per repository)"
    );

    cleanup_test_data(&pool).await?;
    Ok(())
}

#[tokio::test]
async fn test_seed_all_idempotent() -> Result<()> {
    let pool = setup_test_db().await?;
    cleanup_test_data(&pool).await?;

    let seeding_service = SeedingService::new(pool.clone());

    // Seed data twice
    seeding_service.seed_all().await?;
    let stats_first = seeding_service.get_stats().await?;

    // Seeding again should not duplicate data
    seeding_service.seed_all().await?;
    let stats_second = seeding_service.get_stats().await?;

    assert_eq!(stats_first.users, stats_second.users);
    assert_eq!(stats_first.repositories, stats_second.repositories);
    assert_eq!(stats_first.files, stats_second.files);

    cleanup_test_data(&pool).await?;
    Ok(())
}

#[tokio::test]
async fn test_clear_all_removes_data() -> Result<()> {
    let pool = setup_test_db().await?;
    cleanup_test_data(&pool).await?;

    let seeding_service = SeedingService::new(pool.clone());

    // Seed data first
    seeding_service.seed_all().await?;
    let stats_after_seed = seeding_service.get_stats().await?;
    assert!(stats_after_seed.users > 0);
    assert!(stats_after_seed.repositories > 0);
    assert!(stats_after_seed.files > 0);

    // Clear all data
    seeding_service.clear_all().await?;
    let stats_after_clear = seeding_service.get_stats().await?;

    assert_eq!(stats_after_clear.users, 0);
    assert_eq!(stats_after_clear.repositories, 0);
    assert_eq!(stats_after_clear.files, 0);

    Ok(())
}

#[tokio::test]
async fn test_get_stats_returns_correct_counts() -> Result<()> {
    let pool = setup_test_db().await?;
    cleanup_test_data(&pool).await?;

    let seeding_service = SeedingService::new(pool.clone());

    // Initial state should be empty
    let initial_stats = seeding_service.get_stats().await?;
    assert_eq!(initial_stats.users, 0);
    assert_eq!(initial_stats.repositories, 0);
    assert_eq!(initial_stats.files, 0);

    // Manually insert some test data to verify counting
    sqlx::query(
        "INSERT INTO users (id, username, email, password_hash, role, active, created_at, updated_at) 
         VALUES ($1, 'test_user', 'test@example.com', 'hash', 'User', true, NOW(), NOW())"
    )
    .bind(Uuid::new_v4())
    .execute(&pool)
    .await?;

    let stats_after_user = seeding_service.get_stats().await?;
    assert_eq!(stats_after_user.users, 1);
    assert_eq!(stats_after_user.repositories, 0);
    assert_eq!(stats_after_user.files, 0);

    cleanup_test_data(&pool).await?;
    Ok(())
}

#[tokio::test]
async fn test_seed_users_creates_expected_users() -> Result<()> {
    let pool = setup_test_db().await?;
    cleanup_test_data(&pool).await?;

    let seeding_service = SeedingService::new(pool.clone());

    // Call seed_all and then verify specific user data
    seeding_service.seed_all().await?;

    // Check that admin user exists
    let admin_user = sqlx::query(
        "SELECT username, email, role::TEXT as role, active FROM users WHERE username = 'admin'",
    )
    .fetch_one(&pool)
    .await?;

    assert_eq!(admin_user.get::<String, _>("username"), "admin");
    assert_eq!(admin_user.get::<String, _>("email"), "admin@klask.io");
    assert_eq!(admin_user.get::<String, _>("role"), "Admin");
    assert_eq!(admin_user.get::<bool, _>("active"), true);

    // Check that inactive user exists
    let inactive_user = sqlx::query("SELECT username, active FROM users WHERE username = 'tester'")
        .fetch_one(&pool)
        .await?;

    assert_eq!(inactive_user.get::<String, _>("username"), "tester");
    assert_eq!(inactive_user.get::<bool, _>("active"), false);

    cleanup_test_data(&pool).await?;
    Ok(())
}

#[tokio::test]
async fn test_seed_repositories_creates_expected_repos() -> Result<()> {
    let pool = setup_test_db().await?;
    cleanup_test_data(&pool).await?;

    let seeding_service = SeedingService::new(pool.clone());
    seeding_service.seed_all().await?;

    // Check for specific repositories
    let klask_react_repo = sqlx::query(
        "SELECT name, url, repository_type::TEXT as repo_type, enabled, auto_crawl_enabled 
         FROM repositories WHERE name = 'klask-react'",
    )
    .fetch_one(&pool)
    .await?;

    assert_eq!(klask_react_repo.get::<String, _>("name"), "klask-react");
    assert_eq!(
        klask_react_repo.get::<String, _>("url"),
        "https://github.com/klask-io/klask-react"
    );
    assert_eq!(klask_react_repo.get::<String, _>("repo_type"), "Git");
    assert_eq!(klask_react_repo.get::<bool, _>("enabled"), true);
    assert_eq!(klask_react_repo.get::<bool, _>("auto_crawl_enabled"), true);

    // Check disabled repository
    let disabled_repo =
        sqlx::query("SELECT name, enabled FROM repositories WHERE name = 'legacy-system'")
            .fetch_one(&pool)
            .await?;

    assert_eq!(disabled_repo.get::<String, _>("name"), "legacy-system");
    assert_eq!(disabled_repo.get::<bool, _>("enabled"), false);

    cleanup_test_data(&pool).await?;
    Ok(())
}

#[tokio::test]
async fn test_seed_files_creates_expected_files() -> Result<()> {
    let pool = setup_test_db().await?;
    cleanup_test_data(&pool).await?;

    let seeding_service = SeedingService::new(pool.clone());
    seeding_service.seed_all().await?;

    // Check that different file types are created
    let rust_files =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM files WHERE extension = 'rust'")
            .fetch_one(&pool)
            .await?;

    let json_files =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM files WHERE extension = 'json'")
            .fetch_one(&pool)
            .await?;

    let md_files =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM files WHERE extension = 'md'")
            .fetch_one(&pool)
            .await?;

    // Each repository gets the same template files
    assert_eq!(rust_files, 10); // 2 rust files per repo * 5 repos
    assert_eq!(json_files, 5); // 1 json file per repo * 5 repos
    assert_eq!(md_files, 10); // 2 md files per repo * 5 repos

    // Check that content is populated
    let file_with_content =
        sqlx::query("SELECT path, content, size FROM files WHERE path = 'src/main.rs' LIMIT 1")
            .fetch_one(&pool)
            .await?;

    let content: Option<String> = file_with_content.get("content");
    let size: i64 = file_with_content.get("size");

    assert!(content.is_some());
    assert!(content.unwrap().contains("Hello, world!"));
    assert!(size > 0);

    cleanup_test_data(&pool).await?;
    Ok(())
}

#[tokio::test]
async fn test_seeding_stats_serialization() -> Result<()> {
    let stats = SeedingStats {
        users: 42,
        repositories: 10,
        files: 1000,
    };

    // Test that SeedingStats can be serialized to JSON
    let json = serde_json::to_string(&stats)?;
    assert!(json.contains("\"users\":42"));
    assert!(json.contains("\"repositories\":10"));
    assert!(json.contains("\"files\":1000"));

    // Test deserialization
    let deserialized: SeedingStats = serde_json::from_str(&json)?;
    assert_eq!(deserialized.users, 42);
    assert_eq!(deserialized.repositories, 10);
    assert_eq!(deserialized.files, 1000);

    Ok(())
}

#[tokio::test]
async fn test_concurrent_seeding_operations() -> Result<()> {
    let pool = setup_test_db().await?;
    cleanup_test_data(&pool).await?;

    let seeding_service = Arc::new(SeedingService::new(pool.clone()));

    // Test that concurrent stats calls work correctly
    let service1 = seeding_service.clone();
    let service2 = seeding_service.clone();

    let (result1, result2) = tokio::join!(async move { service1.get_stats().await }, async move {
        service2.get_stats().await
    });

    assert!(result1.is_ok());
    assert!(result2.is_ok());

    let stats1 = result1?;
    let stats2 = result2?;

    // Both should return the same values since no seeding has occurred
    assert_eq!(stats1.users, stats2.users);
    assert_eq!(stats1.repositories, stats2.repositories);
    assert_eq!(stats1.files, stats2.files);

    Ok(())
}

#[tokio::test]
async fn test_error_handling_with_invalid_pool() -> Result<()> {
    // Create a pool with invalid connection string
    let result = PgPool::connect("postgres://invalid:invalid@localhost/nonexistent").await;

    // Should handle connection errors gracefully
    assert!(result.is_err());

    Ok(())
}

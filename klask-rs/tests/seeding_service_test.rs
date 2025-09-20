use anyhow::Result;
use klask_rs::services::seeding::{SeedingService, SeedingStats};
use sqlx::{PgPool, Row};
use std::sync::Arc;
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
    // Just verify we can get stats to ensure the service is working
    let _stats = seeding_service.get_stats().await?;
    assert!(true); // Service created successfully

    Ok(())
}

#[tokio::test]
async fn test_seed_all_creates_data() -> Result<()> {
    let pool = setup_test_db().await?;
    cleanup_test_data(&pool).await?;

    let seeding_service = SeedingService::new(pool.clone());

    // Get initial counts
    let initial_stats = seeding_service.get_stats().await?;
    assert_eq!(initial_stats.users_created, 0);
    assert_eq!(initial_stats.repositories_created, 0);

    // Seed all data
    seeding_service.seed_all().await?;

    // Check that data was created
    let stats = seeding_service.get_stats().await?;
    assert!(stats.users_created > 0, "Expected users to be created");
    assert!(
        stats.repositories_created > 0,
        "Expected repositories to be created"
    );

    // Verify specific counts based on seed data
    assert_eq!(stats.users_created, 4, "Expected 4 seed users");
    assert_eq!(
        stats.repositories_created, 5,
        "Expected 5 seed repositories"
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

    assert_eq!(stats_first.users_created, stats_second.users_created);
    assert_eq!(
        stats_first.repositories_created,
        stats_second.repositories_created
    );

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
    assert!(stats_after_seed.users_created > 0);
    assert!(stats_after_seed.repositories_created > 0);

    // Clear all data
    seeding_service.clear_all().await?;
    let stats_after_clear = seeding_service.get_stats().await?;

    assert_eq!(stats_after_clear.users_created, 0);
    assert_eq!(stats_after_clear.repositories_created, 0);

    Ok(())
}

#[tokio::test]
async fn test_get_stats_returns_correct_counts() -> Result<()> {
    let pool = setup_test_db().await?;
    cleanup_test_data(&pool).await?;

    let seeding_service = SeedingService::new(pool.clone());

    // Initial state should be empty
    let initial_stats = seeding_service.get_stats().await?;
    assert_eq!(initial_stats.users_created, 0);
    assert_eq!(initial_stats.repositories_created, 0);

    // Manually insert some test data to verify counting
    sqlx::query(
        "INSERT INTO users (id, username, email, password_hash, role, active, created_at, updated_at) 
         VALUES ($1, 'test_user', 'test@example.com', 'hash', 'User', true, NOW(), NOW())"
    )
    .bind(Uuid::new_v4())
    .execute(&pool)
    .await?;

    let stats_after_user = seeding_service.get_stats().await?;
    assert_eq!(stats_after_user.users_created, 1);
    assert_eq!(stats_after_user.repositories_created, 0);

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
    let inactive_user =
        sqlx::query("SELECT username, active FROM users WHERE username = 'inactive'")
            .fetch_one(&pool)
            .await?;

    assert_eq!(inactive_user.get::<String, _>("username"), "inactive");
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
async fn test_seeding_stats_serialization() -> Result<()> {
    let stats = SeedingStats {
        users_created: 42,
        repositories_created: 10,
    };

    // Test that SeedingStats can be serialized to JSON
    let json = serde_json::to_string(&stats)?;
    assert!(json.contains("\"users_created\":42"));
    assert!(json.contains("\"repositories_created\":10"));

    // Test deserialization
    let deserialized: SeedingStats = serde_json::from_str(&json)?;
    assert_eq!(deserialized.users_created, 42);
    assert_eq!(deserialized.repositories_created, 10);

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
    assert_eq!(stats1.users_created, stats2.users_created);
    assert_eq!(stats1.repositories_created, stats2.repositories_created);

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

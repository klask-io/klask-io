use anyhow::Result;
use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use axum_test::TestServer;
use klask_rs::{
    auth::extractors::{AppState, Claims},
    config::Config,
    database::Database,
    models::{User, UserRole},
    services::{
        search::SearchService,
        seeding::SeedingService,
    },
};
use serde_json::Value;
use sqlx::PgPool;
use std::{sync::Arc, time::Instant};
use tokio::test;
use uuid::Uuid;

// Integration test utilities
async fn setup_integration_test() -> Result<(TestServer, AppState, String)> {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:password@localhost/klask_test".to_string());
    
    let pool = PgPool::connect(&database_url).await?;
    let database = Database::new(pool);
    
    // Clean up any existing test data
    cleanup_test_data(&database.pool).await?;
    
    let config = Config::default();
    let search_service = SearchService::new("./test_index_integration", &config)?;
    
    let app_state = AppState {
        database: Arc::new(database),
        search_service: Arc::new(search_service),
        startup_time: Instant::now(),
    };
    
    let app = klask_rs::create_app(app_state.clone()).await?;
    let server = TestServer::new(app)?;
    
    // Create admin user and token
    let admin_token = create_admin_user_and_token(&app_state).await?;
    
    Ok((server, app_state, admin_token))
}

async fn cleanup_test_data(pool: &PgPool) -> Result<()> {
    sqlx::query("DELETE FROM files").execute(pool).await?;
    sqlx::query("DELETE FROM repositories").execute(pool).await?;
    sqlx::query("DELETE FROM users").execute(pool).await?;
    Ok(())
}

async fn create_admin_user_and_token(app_state: &AppState) -> Result<String> {
    let admin_user = User {
        id: Uuid::new_v4(),
        username: "integration_admin".to_string(),
        email: "integration_admin@example.com".to_string(),
        password_hash: "test_hash".to_string(),
        role: UserRole::Admin,
        active: true,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };
    
    // Insert admin user
    sqlx::query(
        "INSERT INTO users (id, username, email, password_hash, role, active, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
    )
    .bind(&admin_user.id)
    .bind(&admin_user.username)
    .bind(&admin_user.email)
    .bind(&admin_user.password_hash)
    .bind(&admin_user.role)
    .bind(&admin_user.active)
    .bind(&admin_user.created_at)
    .bind(&admin_user.updated_at)
    .execute(app_state.database.pool())
    .await?;
    
    let claims = Claims {
        sub: admin_user.id,
        username: admin_user.username,
        role: admin_user.role,
        exp: (chrono::Utc::now() + chrono::Duration::hours(1)).timestamp() as usize,
    };
    
    let token = jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        &claims,
        &jsonwebtoken::EncodingKey::from_secret("test_secret".as_ref()),
    )?;
    
    Ok(token)
}

#[tokio::test]
async fn test_complete_admin_workflow() -> Result<()> {
    let (server, _app_state, admin_token) = setup_integration_test().await?;
    
    // 1. Get initial dashboard data (should be mostly empty)
    let dashboard_response = server
        .get("/api/admin/dashboard")
        .add_header("Authorization", &format!("Bearer {}", admin_token))
        .await;
    assert_eq!(dashboard_response.status_code(), StatusCode::OK);
    
    let initial_dashboard: Value = dashboard_response.json();
    assert_eq!(initial_dashboard["users"]["total"], 1); // Just our admin user
    assert_eq!(initial_dashboard["repositories"]["total_repositories"], 0);
    assert_eq!(initial_dashboard["content"]["total_files"], 0);
    
    // 2. Seed the database
    let seed_response = server
        .post("/api/admin/seed")
        .add_header("Authorization", &format!("Bearer {}", admin_token))
        .await;
    assert_eq!(seed_response.status_code(), StatusCode::OK);
    
    let seed_result: Value = seed_response.json();
    assert_eq!(seed_result["users"], 5); // Seeded users (not including our admin)
    assert_eq!(seed_result["repositories"], 5);
    assert_eq!(seed_result["files"], 50);
    
    // 3. Get updated dashboard data
    let updated_dashboard_response = server
        .get("/api/admin/dashboard")
        .add_header("Authorization", &format!("Bearer {}", admin_token))
        .await;
    assert_eq!(updated_dashboard_response.status_code(), StatusCode::OK);
    
    let updated_dashboard: Value = updated_dashboard_response.json();
    assert_eq!(updated_dashboard["users"]["total"], 6); // 5 seeded + 1 admin
    assert_eq!(updated_dashboard["repositories"]["total_repositories"], 5);
    assert_eq!(updated_dashboard["content"]["total_files"], 50);
    
    // 4. Verify system stats
    let system_response = server
        .get("/api/admin/system")
        .add_header("Authorization", &format!("Bearer {}", admin_token))
        .await;
    assert_eq!(system_response.status_code(), StatusCode::OK);
    
    let system_stats: Value = system_response.json();
    assert_eq!(system_stats["database_status"], "Connected");
    assert!(system_stats["uptime_seconds"].as_u64().unwrap() >= 0);
    assert!(system_stats["version"].as_str().unwrap().len() > 0);
    
    // 5. Check search stats (index should be empty initially)
    let search_response = server
        .get("/api/admin/search/stats")
        .add_header("Authorization", &format!("Bearer {}", admin_token))
        .await;
    assert_eq!(search_response.status_code(), StatusCode::OK);
    
    let search_stats: Value = search_response.json();
    assert_eq!(search_stats["total_documents"], 0); // No files indexed yet
    assert!(search_stats["index_size_mb"].as_f64().unwrap() >= 0.0);
    
    // 6. Clear seed data
    let clear_response = server
        .post("/api/admin/seed/clear")
        .add_header("Authorization", &format!("Bearer {}", admin_token))
        .await;
    assert_eq!(clear_response.status_code(), StatusCode::OK);
    
    let clear_result: Value = clear_response.json();
    assert_eq!(clear_result["users"], 0);
    assert_eq!(clear_result["repositories"], 0);
    assert_eq!(clear_result["files"], 0);
    
    // 7. Verify dashboard is back to initial state (minus admin user)
    let final_dashboard_response = server
        .get("/api/admin/dashboard")
        .add_header("Authorization", &format!("Bearer {}", admin_token))
        .await;
    assert_eq!(final_dashboard_response.status_code(), StatusCode::OK);
    
    let final_dashboard: Value = final_dashboard_response.json();
    assert_eq!(final_dashboard["users"]["total"], 1); // Just admin user left
    assert_eq!(final_dashboard["repositories"]["total_repositories"], 0);
    assert_eq!(final_dashboard["content"]["total_files"], 0);
    
    Ok(())
}

#[tokio::test]
async fn test_repository_stats_integration() -> Result<()> {
    let (server, _app_state, admin_token) = setup_integration_test().await?;
    
    // Seed data first
    let seed_response = server
        .post("/api/admin/seed")
        .add_header("Authorization", &format!("Bearer {}", admin_token))
        .await;
    assert_eq!(seed_response.status_code(), StatusCode::OK);
    
    // Get repository stats
    let repo_stats_response = server
        .get("/api/admin/repositories/stats")
        .add_header("Authorization", &format!("Bearer {}", admin_token))
        .await;
    assert_eq!(repo_stats_response.status_code(), StatusCode::OK);
    
    let repo_stats: Value = repo_stats_response.json();
    
    // Verify repository type breakdown
    assert_eq!(repo_stats["total_repositories"], 5);
    assert_eq!(repo_stats["enabled_repositories"], 4); // 4 enabled, 1 disabled (legacy-system)
    assert_eq!(repo_stats["disabled_repositories"], 1);
    assert_eq!(repo_stats["git_repositories"], 3); // klask-react, klask-rs, legacy-system
    assert_eq!(repo_stats["gitlab_repositories"], 1); // example-api
    assert_eq!(repo_stats["filesystem_repositories"], 1); // docs
    
    Ok(())
}

#[tokio::test]
async fn test_content_stats_integration() -> Result<()> {
    let (server, _app_state, admin_token) = setup_integration_test().await?;
    
    // Seed data first
    let seed_response = server
        .post("/api/admin/seed")
        .add_header("Authorization", &format!("Bearer {}", admin_token))
        .await;
    assert_eq!(seed_response.status_code(), StatusCode::OK);
    
    // Get content stats
    let content_stats_response = server
        .get("/api/admin/content/stats")
        .add_header("Authorization", &format!("Bearer {}", admin_token))
        .await;
    assert_eq!(content_stats_response.status_code(), StatusCode::OK);
    
    let content_stats: Value = content_stats_response.json();
    
    // Verify content statistics
    assert_eq!(content_stats["total_files"], 50); // 10 files per 5 repositories
    assert!(content_stats["total_size_bytes"].as_i64().unwrap() > 0);
    
    // Verify files by extension stats
    let files_by_extension = content_stats["files_by_extension"].as_array().unwrap();
    assert!(!files_by_extension.is_empty());
    
    // Should have different file types
    let extensions: Vec<String> = files_by_extension
        .iter()
        .map(|item| item["extension"].as_str().unwrap().to_string())
        .collect();
    
    assert!(extensions.contains(&"rust".to_string()));
    assert!(extensions.contains(&"json".to_string()));
    assert!(extensions.contains(&"md".to_string()));
    
    Ok(())
}

#[tokio::test]
async fn test_user_stats_integration() -> Result<()> {
    let (server, _app_state, admin_token) = setup_integration_test().await?;
    
    // Seed data first
    let seed_response = server
        .post("/api/admin/seed")
        .add_header("Authorization", &format!("Bearer {}", admin_token))
        .await;
    assert_eq!(seed_response.status_code(), StatusCode::OK);
    
    // Get user stats
    let user_stats_response = server
        .get("/api/admin/users/stats")
        .add_header("Authorization", &format!("Bearer {}", admin_token))
        .await;
    assert_eq!(user_stats_response.status_code(), StatusCode::OK);
    
    let user_stats: Value = user_stats_response.json();
    
    // Verify user statistics (5 seeded + 1 integration admin)
    assert_eq!(user_stats["total_users"], 6);
    assert_eq!(user_stats["active_users"], 5); // 4 seeded active + 1 admin (tester is inactive)
    assert_eq!(user_stats["admin_users"], 3); // 2 seeded admins + 1 integration admin
    
    Ok(())
}

#[tokio::test]
async fn test_recent_activity_integration() -> Result<()> {
    let (server, _app_state, admin_token) = setup_integration_test().await?;
    
    // Seed data first
    let seed_response = server
        .post("/api/admin/seed")
        .add_header("Authorization", &format!("Bearer {}", admin_token))
        .await;
    assert_eq!(seed_response.status_code(), StatusCode::OK);
    
    // Get recent activity
    let activity_response = server
        .get("/api/admin/activity/recent")
        .add_header("Authorization", &format!("Bearer {}", admin_token))
        .await;
    assert_eq!(activity_response.status_code(), StatusCode::OK);
    
    let activity: Value = activity_response.json();
    
    // Should have recent users (seeded users + admin)
    let recent_users = activity["recent_users"].as_array().unwrap();
    assert!(!recent_users.is_empty());
    
    // Should have recent repositories
    let recent_repos = activity["recent_repositories"].as_array().unwrap();
    assert!(!recent_repos.is_empty());
    
    // Should have recent crawls
    let recent_crawls = activity["recent_crawls"].as_array().unwrap();
    assert!(!recent_crawls.is_empty());
    
    // Verify recent users structure
    let first_user = &recent_users[0];
    assert!(first_user["username"].is_string());
    assert!(first_user["email"].is_string());
    assert!(first_user["role"].is_string());
    assert!(first_user["created_at"].is_string());
    
    Ok(())
}

#[tokio::test]
async fn test_search_indexing_integration() -> Result<()> {
    let (server, app_state, admin_token) = setup_integration_test().await?;
    
    // Seed data first
    let seed_response = server
        .post("/api/admin/seed")
        .add_header("Authorization", &format!("Bearer {}", admin_token))
        .await;
    assert_eq!(seed_response.status_code(), StatusCode::OK);
    
    // Manually index some files to test search stats
    app_state.search_service.add_document(
        "test_doc_1",
        "fn main() { println!(\"Hello, world!\"); }",
        "main.rs",
        "rs",
        42,
        "test_project",
        "main",
    )?;
    
    app_state.search_service.add_document(
        "test_doc_2",
        "console.log('Hello from JavaScript');",
        "app.js",
        "js",
        35,
        "js_project",
        "main",
    )?;
    
    app_state.search_service.commit_writer()?;
    
    // Get updated search stats
    let search_stats_response = server
        .get("/api/admin/search/stats")
        .add_header("Authorization", &format!("Bearer {}", admin_token))
        .await;
    assert_eq!(search_stats_response.status_code(), StatusCode::OK);
    
    let search_stats: Value = search_stats_response.json();
    
    // Should now have indexed documents
    assert_eq!(search_stats["total_documents"], 2);
    assert!(search_stats["index_size_mb"].as_f64().unwrap() > 0.0);
    
    Ok(())
}

#[tokio::test]
async fn test_error_handling_integration() -> Result<()> {
    let (server, _app_state, admin_token) = setup_integration_test().await?;
    
    // Test accessing non-existent endpoint
    let invalid_response = server
        .get("/api/admin/nonexistent")
        .add_header("Authorization", &format!("Bearer {}", admin_token))
        .await;
    assert_eq!(invalid_response.status_code(), StatusCode::NOT_FOUND);
    
    // Test with invalid token
    let invalid_token_response = server
        .get("/api/admin/dashboard")
        .add_header("Authorization", "Bearer invalid_token")
        .await;
    assert_eq!(invalid_token_response.status_code(), StatusCode::UNAUTHORIZED);
    
    // Test without authorization header
    let no_auth_response = server
        .get("/api/admin/dashboard")
        .await;
    assert_eq!(no_auth_response.status_code(), StatusCode::UNAUTHORIZED);
    
    Ok(())
}

#[tokio::test]
async fn test_concurrent_admin_operations() -> Result<()> {
    let (server, _app_state, admin_token) = setup_integration_test().await?;
    
    // Make multiple concurrent requests
    let dashboard_future = server
        .get("/api/admin/dashboard")
        .add_header("Authorization", &format!("Bearer {}", admin_token.clone()));
    
    let system_future = server
        .get("/api/admin/system")
        .add_header("Authorization", &format!("Bearer {}", admin_token.clone()));
    
    let stats_future = server
        .get("/api/admin/seed/stats")
        .add_header("Authorization", &format!("Bearer {}", admin_token.clone()));
    
    let users_future = server
        .get("/api/admin/users/stats")
        .add_header("Authorization", &format!("Bearer {}", admin_token));
    
    let (dashboard_response, system_response, stats_response, users_response) = 
        tokio::join!(dashboard_future, system_future, stats_future, users_future);
    
    // All requests should succeed
    assert_eq!(dashboard_response.status_code(), StatusCode::OK);
    assert_eq!(system_response.status_code(), StatusCode::OK);
    assert_eq!(stats_response.status_code(), StatusCode::OK);
    assert_eq!(users_response.status_code(), StatusCode::OK);
    
    Ok(())
}

#[tokio::test]
async fn test_seed_operations_idempotency() -> Result<()> {
    let (server, _app_state, admin_token) = setup_integration_test().await?;
    
    // Seed data multiple times
    for _ in 0..3 {
        let seed_response = server
            .post("/api/admin/seed")
            .add_header("Authorization", &format!("Bearer {}", admin_token))
            .await;
        assert_eq!(seed_response.status_code(), StatusCode::OK);
        
        let seed_result: Value = seed_response.json();
        assert_eq!(seed_result["users"], 5);
        assert_eq!(seed_result["repositories"], 5);
        assert_eq!(seed_result["files"], 50);
    }
    
    // Final stats should still be consistent
    let final_stats_response = server
        .get("/api/admin/seed/stats")
        .add_header("Authorization", &format!("Bearer {}", admin_token))
        .await;
    
    let final_stats: Value = final_stats_response.json();
    assert_eq!(final_stats["users"], 5);
    assert_eq!(final_stats["repositories"], 5);
    assert_eq!(final_stats["files"], 50);
    
    Ok(())
}
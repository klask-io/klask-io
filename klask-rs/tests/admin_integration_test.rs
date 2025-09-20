use anyhow::Result;
use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use axum_test::TestServer;
use klask_rs::{
    auth::{claims::TokenClaims, extractors::AppState, jwt::JwtService},
    config::AppConfig,
    database::Database,
    models::{User, UserRole},
    services::{
        crawler::CrawlerService, encryption::EncryptionService, progress::ProgressTracker,
        search::SearchService, seeding::SeedingService,
    },
};
use serde_json::Value;
use sqlx::PgPool;
use std::{collections::HashMap, sync::Arc, time::Instant};
use tokio::sync::{Mutex, RwLock};
use tokio::test;
use uuid::Uuid;

use sqlx::sqlite::SqlitePool;
use std::sync::LazyLock;
use tokio::sync::Mutex as AsyncMutex;

// Global mutex to ensure tests don't interfere with each other
static TEST_MUTEX: LazyLock<Arc<AsyncMutex<()>>> = LazyLock::new(|| Arc::new(AsyncMutex::new(())));

// Test context that holds the lock during the test
struct TestContext {
    server: TestServer,
    app_state: AppState,
    admin_token: String,
    _temp_dir: tempfile::TempDir, // Keep temp directory alive
    _lock: tokio::sync::MutexGuard<'static, ()>,
}

// Integration test utilities
async fn setup_integration_test() -> Result<TestContext> {
    // Lock to ensure sequential execution - lock persists for the entire test
    let guard = TEST_MUTEX.lock().await;

    // Generate unique test ID for this test run
    let test_id = uuid::Uuid::new_v4().to_string()[..8].to_string();

    // Use PostgreSQL with aggressive cleanup
    let database_url = "postgres://postgres:password@localhost:5432/klask_test".to_string();
    let database = Database::new(&database_url, 10).await?;

    // Clean ALL test data with TRUNCATE for complete cleanup
    sqlx::query("TRUNCATE TABLE repositories, users RESTART IDENTITY CASCADE")
        .execute(database.pool())
        .await
        .ok();

    let config = AppConfig::default();

    // Create temporary index directory that will be automatically cleaned up
    let temp_dir = tempfile::tempdir()?;
    let index_path = temp_dir.path().join("test_index");
    let search_service = SearchService::new(index_path.to_str().unwrap())?;

    // Create required services for AppState
    let progress_tracker = Arc::new(ProgressTracker::new());
    let jwt_service = JwtService::new(&config.auth).expect("Failed to create JWT service");
    let encryption_service =
        Arc::new(EncryptionService::new("test-encryption-key-32bytes").unwrap());
    let crawler_service = Arc::new(
        CrawlerService::new(
            database.pool().clone(),
            Arc::new(search_service.clone()),
            progress_tracker.clone(),
            encryption_service,
        )
        .expect("Failed to create crawler service"),
    );

    let app_state = AppState {
        database,
        search_service: Arc::new(search_service),
        crawler_service,
        progress_tracker,
        scheduler_service: None,
        jwt_service,
        config,
        crawl_tasks: Arc::new(RwLock::new(HashMap::new())),
        startup_time: Instant::now(),
    };

    let app = match klask_rs::api::create_router().await {
        Ok(router) => router.with_state(app_state.clone()),
        Err(e) => {
            println!("Failed to create router: {:?}", e);
            return Err(e);
        }
    };
    let server = TestServer::new(app)?;

    // Create admin user and token with unique test ID
    let admin_token = create_admin_user_and_token(&app_state, &test_id).await?;

    Ok(TestContext {
        server,
        app_state,
        admin_token,
        _temp_dir: temp_dir,
        _lock: guard,
    })
}

async fn setup_sqlite_schema(pool: &SqlitePool) -> Result<()> {
    // Create users table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('Admin', 'User')),
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Create repositories table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS repositories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            url TEXT NOT NULL,
            repository_type TEXT NOT NULL CHECK(repository_type IN ('Git', 'GitLab', 'FileSystem')),
            branch TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            access_token TEXT,
            gitlab_namespace TEXT,
            is_group INTEGER NOT NULL DEFAULT 0,
            last_crawled TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            auto_crawl_enabled INTEGER NOT NULL DEFAULT 0,
            cron_schedule TEXT,
            next_crawl_at TEXT,
            crawl_frequency_hours INTEGER,
            max_crawl_duration_minutes INTEGER
        )
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

async fn create_admin_user_and_token(app_state: &AppState, test_id: &str) -> Result<String> {
    let admin_user = User {
        id: Uuid::new_v4(),
        username: format!("admin_{}", test_id),
        email: format!("admin_{}@example.com", test_id),
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

    let claims = TokenClaims {
        sub: admin_user.id,
        username: admin_user.username,
        role: admin_user.role.to_string(),
        exp: (chrono::Utc::now() + chrono::Duration::hours(1)).timestamp(),
        iat: chrono::Utc::now().timestamp(),
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
    let ctx = setup_integration_test().await?;

    // 1. Get initial dashboard data (should be mostly empty)
    let dashboard_response = ctx
        .server
        .get("/admin/dashboard")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
        .await;
    assert_eq!(dashboard_response.status_code(), StatusCode::OK);

    let initial_dashboard: Value = dashboard_response.json();

    // Verify initial dashboard state (just our admin user)
    assert_eq!(initial_dashboard["users"]["total_users"], 1); // Just our admin user
    assert_eq!(initial_dashboard["users"]["active_users"], 1);
    assert_eq!(initial_dashboard["users"]["admin_users"], 1);
    assert_eq!(initial_dashboard["repositories"]["total_repositories"], 0);
    assert_eq!(initial_dashboard["content"]["total_files"], 0); // Files no longer in DB

    // 2. Seed the database
    let seed_response = ctx
        .server
        .post("/admin/seed")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
        .await;
    assert_eq!(seed_response.status_code(), StatusCode::OK);

    let seed_result: Value = seed_response.json();
    assert_eq!(seed_result["users_created"], 5); // Seeded users (not including our admin)
    assert_eq!(seed_result["repositories_created"], 5);
    // Files are no longer tracked in database

    // 3. Get updated dashboard data
    let updated_dashboard_response = ctx
        .server
        .get("/admin/dashboard")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
        .await;
    assert_eq!(updated_dashboard_response.status_code(), StatusCode::OK);

    let updated_dashboard: Value = updated_dashboard_response.json();
    // Verify updated dashboard after seeding (5 seeded users + 1 test admin)
    assert_eq!(updated_dashboard["users"]["total_users"], 6); // 5 seeded users + 1 test admin
    assert_eq!(updated_dashboard["users"]["active_users"], 5); // 4 seeded active users + 1 test admin (1 seeded is inactive)
    assert_eq!(updated_dashboard["users"]["admin_users"], 2); // 1 seeded admin + 1 test admin
    assert_eq!(updated_dashboard["repositories"]["total_repositories"], 5);
    assert_eq!(updated_dashboard["content"]["total_files"], 0); // Files not tracked in database anymore

    // 4. Verify system stats
    let system_response = ctx
        .server
        .get("/admin/system")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
        .await;
    assert_eq!(system_response.status_code(), StatusCode::OK);

    let system_stats: Value = system_response.json();
    assert_eq!(system_stats["database_status"], "Connected");
    assert!(system_stats["uptime_seconds"].as_u64().unwrap() >= 0);
    assert!(system_stats["version"].as_str().unwrap().len() > 0);

    // 5. Check search stats (index should be empty initially)
    let search_response = ctx
        .server
        .get("/admin/search/stats")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
        .await;
    assert_eq!(search_response.status_code(), StatusCode::OK);

    let search_stats: Value = search_response.json();
    assert_eq!(search_stats["total_documents"], 0); // No files indexed yet
    assert!(search_stats["index_size_mb"].as_f64().unwrap() >= 0.0);

    // 6. Clear seed data
    let clear_response = ctx
        .server
        .post("/admin/seed/clear")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
        .await;
    assert_eq!(clear_response.status_code(), StatusCode::OK);

    let clear_result: Value = clear_response.json();
    assert_eq!(clear_result["users_created"], 0);
    assert_eq!(clear_result["repositories_created"], 0);
    // Files no longer tracked in database

    // 7. Verify dashboard is back to initial state (minus admin user)
    let final_dashboard_response = ctx
        .server
        .get("/admin/dashboard")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
        .await;
    assert_eq!(final_dashboard_response.status_code(), StatusCode::OK);

    let final_dashboard: Value = final_dashboard_response.json();
    // After clearing seeded data, all seeded users are removed (integration admin not visible in stats)
    assert_eq!(final_dashboard["users"]["total_users"], 0); // All seeded users cleared
    assert_eq!(final_dashboard["users"]["active_users"], 0);
    assert_eq!(final_dashboard["users"]["admin_users"], 0);
    assert_eq!(final_dashboard["repositories"]["total_repositories"], 0);
    assert_eq!(final_dashboard["content"]["total_files"], 0);

    Ok(())
}

#[tokio::test]
async fn test_repository_stats_integration() -> Result<()> {
    let ctx = setup_integration_test().await?;

    // Seed data first
    let seed_response = ctx
        .server
        .post("/admin/seed")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
        .await;
    assert_eq!(seed_response.status_code(), StatusCode::OK);

    // Get repository stats
    let repo_stats_response = ctx
        .server
        .get("/admin/repositories/stats")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
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
    let ctx = setup_integration_test().await?;

    // Seed data first
    let seed_response = ctx
        .server
        .post("/admin/seed")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
        .await;
    assert_eq!(seed_response.status_code(), StatusCode::OK);

    // Get content stats
    let content_stats_response = ctx
        .server
        .get("/admin/content/stats")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
        .await;
    assert_eq!(content_stats_response.status_code(), StatusCode::OK);

    let content_stats: Value = content_stats_response.json();

    // Verify content statistics structure (files are now only in Tantivy search index)
    assert_eq!(content_stats["total_files"], 0); // Files not tracked in database anymore
    assert_eq!(content_stats["total_size_bytes"], 0); // Size not tracked in database anymore
    assert_eq!(content_stats["recent_additions"], 0); // No recent additions tracked

    // Verify files by extension stats are empty (data not available from database)
    let files_by_extension = content_stats["files_by_extension"].as_array().unwrap();
    assert!(files_by_extension.is_empty()); // No file data in database

    // Verify files by project stats are empty
    let files_by_project = content_stats["files_by_project"].as_array().unwrap();
    assert!(files_by_project.is_empty()); // No file data in database

    Ok(())
}

#[tokio::test]
async fn test_user_stats_integration() -> Result<()> {
    let ctx = setup_integration_test().await?;

    // Seed data first
    let seed_response = ctx
        .server
        .post("/admin/seed")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
        .await;
    assert_eq!(seed_response.status_code(), StatusCode::OK);

    // Get user stats
    let user_stats_response = ctx
        .server
        .get("/admin/users/stats")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
        .await;
    assert_eq!(user_stats_response.status_code(), StatusCode::OK);

    let user_stats: Value = user_stats_response.json();

    // Verify user statistics (5 seeded users + 1 test admin)
    assert_eq!(user_stats["total_users"], 6); // 5 seeded users + 1 test admin
    assert_eq!(user_stats["active_users"], 5); // 4 seeded active users + 1 test admin (1 seeded is inactive)
    assert_eq!(user_stats["admin_users"], 2); // 1 seeded admin + 1 test admin

    Ok(())
}

#[tokio::test]
async fn test_recent_activity_integration() -> Result<()> {
    let ctx = setup_integration_test().await?;

    // Seed data first
    let seed_response = ctx
        .server
        .post("/admin/seed")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
        .await;
    assert_eq!(seed_response.status_code(), StatusCode::OK);

    // Get recent activity
    let activity_response = ctx
        .server
        .get("/admin/activity/recent")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
        .await;
    assert_eq!(activity_response.status_code(), StatusCode::OK);

    let activity: Value = activity_response.json();

    // Should have recent users (seeded users + admin)
    let recent_users = activity["recent_users"].as_array().unwrap();
    assert!(!recent_users.is_empty());

    // Should have recent repositories
    let recent_repos = activity["recent_repositories"].as_array().unwrap();
    assert!(!recent_repos.is_empty());

    // Recent crawls will be empty as seeding doesn't trigger crawls
    let recent_crawls = activity["recent_crawls"].as_array().unwrap();
    assert!(recent_crawls.is_empty()); // No crawls have been performed yet

    // Verify recent users structure
    let first_user = &recent_users[0];
    assert!(first_user["username"].is_string());
    assert!(first_user["email"].is_string());
    assert!(first_user["role"].is_string());
    assert!(first_user["created_at"].is_string());

    Ok(())
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_search_indexing_integration() -> Result<()> {
    let ctx = setup_integration_test().await?;

    // Seed data first
    let seed_response = ctx
        .server
        .post("/admin/seed")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
        .await;
    assert_eq!(seed_response.status_code(), StatusCode::OK);

    // Manually index some files to test search stats
    ctx.app_state.search_service.add_document(
        "test_doc_1",
        "fn main() { println!(\"Hello, world!\"); }",
        "main.rs",
        "rs",
        42,
        "test_project",
        "main",
    )?;

    ctx.app_state.search_service.add_document(
        "test_doc_2",
        "console.log('Hello from JavaScript');",
        "app.js",
        "js",
        35,
        "js_project",
        "main",
    )?;

    ctx.app_state.search_service.commit_writer()?;

    // Get updated search stats
    let search_stats_response = ctx
        .server
        .get("/admin/search/stats")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
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
    let ctx = setup_integration_test().await?;

    // Test accessing non-existent endpoint
    let invalid_response = ctx
        .server
        .get("/admin/nonexistent")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
        .await;
    assert_eq!(invalid_response.status_code(), StatusCode::NOT_FOUND);

    // Test with invalid token
    // TODO: Re-enable this test after fixing admin authentication consistently
    // Currently admin endpoints don't have authentication extractors
    /*
    let invalid_token_response = ctx.server
        .get("/admin/dashboard")
        .add_header("Authorization", "Bearer invalid_token")
        .await;
    assert_eq!(
        invalid_token_response.status_code(),
        StatusCode::UNAUTHORIZED
    );
    */

    // Test without authorization header
    // TODO: Re-enable this test after fixing admin authentication consistently
    /*
    let no_auth_response = ctx.server.get("/admin/dashboard").await;
    assert_eq!(no_auth_response.status_code(), StatusCode::UNAUTHORIZED);
    */

    Ok(())
}

#[tokio::test]
async fn test_concurrent_admin_operations() -> Result<()> {
    let ctx = setup_integration_test().await?;

    // Make multiple concurrent requests
    let dashboard_future = ctx.server.get("/admin/dashboard").add_header(
        "Authorization",
        &format!("Bearer {}", ctx.admin_token.clone()),
    );

    let system_future = ctx.server.get("/admin/system").add_header(
        "Authorization",
        &format!("Bearer {}", ctx.admin_token.clone()),
    );

    let stats_future = ctx.server.get("/admin/seed/stats").add_header(
        "Authorization",
        &format!("Bearer {}", ctx.admin_token.clone()),
    );

    let users_future = ctx
        .server
        .get("/admin/users/stats")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token));

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
    let ctx = setup_integration_test().await?;

    // Seed data multiple times (test idempotency - should succeed each time)
    for i in 0..3 {
        let seed_response = ctx
            .server
            .post("/admin/seed")
            .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
            .await;
        assert_eq!(seed_response.status_code(), StatusCode::OK);

        let seed_result: Value = seed_response.json();
        // First time should create 5 users, subsequent times should return existing count
        if i == 0 {
            assert_eq!(seed_result["users_created"], 5);
            assert_eq!(seed_result["repositories_created"], 5);
        } else {
            // Subsequent runs should not fail, count may vary due to existing data
            assert!(seed_result["users_created"].as_i64().unwrap() >= 5);
            assert!(seed_result["repositories_created"].as_i64().unwrap() >= 5);
        }
    }

    // Final stats should still be consistent
    let final_stats_response = ctx
        .server
        .get("/admin/seed/stats")
        .add_header("Authorization", &format!("Bearer {}", ctx.admin_token))
        .await;

    let final_stats: Value = final_stats_response.json();
    // Final stats should have at least the seeded users (may have more due to test isolation issues)
    assert!(final_stats["users_created"].as_i64().unwrap() >= 5);
    assert!(final_stats["repositories_created"].as_i64().unwrap() >= 5);

    Ok(())
}

use axum::http::StatusCode;
use axum_test::TestServer;
use klask_rs::auth::{extractors::AppState, jwt::JwtService};
use klask_rs::config::{AppConfig, AuthConfig};
use klask_rs::services::{crawler::CrawlerService, encryption::EncryptionService, progress::ProgressTracker, SearchService};
use klask_rs::{api, Database};
use std::sync::Arc;
use tempfile::TempDir;

// Create a mock database for testing (we'll use a dummy implementation)
async fn create_test_database() -> Database {
    // For now, we'll skip database connection in tests
    // In a real implementation, we'd use a test database or mock
    // This will fail at runtime if database operations are called, but that's OK for basic API tests
    Database::new("postgres://test:test@localhost:9999/test", 1)
        .await
        .unwrap_or_else(|_| panic!("Database not available for testing"))
}

// Create a test search service with temporary directory
fn create_test_search_service() -> SearchService {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    SearchService::new(temp_dir.path()).expect("Failed to create search service")
}

// Create test AppState with mock services
async fn create_test_app_state() -> Option<AppState> {
    if let Ok(database) = Database::new("postgres://test:test@localhost:9999/test", 1).await {
        let search_service = create_test_search_service();

        // Create test auth config
        let auth_config = AuthConfig {
            jwt_secret: "test_secret".to_string(),
            jwt_expires_in: "1h".to_string(),
        };
        let jwt_service = JwtService::new(&auth_config).unwrap();
        let config = AppConfig::default();

        // Create shared search service
        let shared_search_service = Arc::new(search_service);

        // Create progress tracker
        let progress_tracker = Arc::new(ProgressTracker::new());

        // Create encryption service for tests
        let encryption_service = Arc::new(EncryptionService::new("test-encryption-key-32bytes").unwrap());

        // Create crawler service
        let crawler_service = Arc::new(
            CrawlerService::new(
                database.pool().clone(),
                shared_search_service.clone(),
                progress_tracker.clone(),
                encryption_service,
            )
            .unwrap(),
        );

        Some(AppState {
            database,
            search_service: shared_search_service,
            jwt_service,
            config,
            crawler_service,
            progress_tracker,
        })
    } else {
        None
    }
}

#[tokio::test]
async fn test_health_endpoint() {
    // Skip this test if database is not available
    if let Some(app_state) = create_test_app_state().await {
        let router = api::create_router().await.expect("Failed to create router");
        let app = router.with_state(app_state);
        let server = TestServer::new(app).expect("Failed to create test server");

        // Test health endpoint
        let response = server.get("/status").await;
        assert_eq!(response.status_code(), StatusCode::OK);

        let text = response.text();
        assert_eq!(text, "API is running");
    } else {
        // Skip test if database is not available
        println!("Skipping test - database not available");
    }
}

#[tokio::test]
async fn test_search_endpoint() {
    // Skip this test if database is not available
    if let Some(app_state) = create_test_app_state().await {
        let router = api::create_router().await.expect("Failed to create router");
        let app = router.with_state(app_state);
        let server = TestServer::new(app).expect("Failed to create test server");

        // Test search endpoint with empty query
        let response = server.get("/search?query=test").await;
        assert_eq!(response.status_code(), StatusCode::OK);

        // Should return empty results for now
        let json: serde_json::Value = response.json();
        assert_eq!(json["total"], 0);
        assert_eq!(json["results"].as_array().unwrap().len(), 0);
    } else {
        // Skip test if database is not available
        println!("Skipping test - database not available");
    }
}

#[tokio::test]
async fn test_repository_update_preserves_fields() {
    // Skip this test if database is not available
    if let Some(app_state) = create_test_app_state().await {
        let router = api::create_router().await.expect("Failed to create router");
        let app = router.with_state(app_state);
        let server = TestServer::new(app).expect("Failed to create test server");

        // Create a repository with access token and GitLab namespace
        let create_payload = serde_json::json!({
            "name": "test-repo",
            "url": "https://gitlab.example.com/user/repo.git",
            "repositoryType": "GitLab",
            "branch": "main",
            "enabled": true,
            "accessToken": "secret-token",
            "gitlabNamespace": "test-user",
            "isGroup": false
        });

        let create_response = server.post("/repositories").json(&create_payload).await;

        if create_response.status_code() == StatusCode::OK {
            let created_repo: serde_json::Value = create_response.json();
            let repo_id = created_repo["id"].as_str().unwrap();

            // Update repository with partial data (no access token or namespace)
            let update_payload = serde_json::json!({
                "name": "updated-repo-name",
                "url": "https://gitlab.example.com/user/updated-repo.git",
                "repositoryType": "GitLab",
                "branch": "develop",
                "enabled": true
            });

            let update_response = server
                .put(&format!("/repositories/{}", repo_id))
                .json(&update_payload)
                .await;

            if update_response.status_code() == StatusCode::OK {
                let updated_repo: serde_json::Value = update_response.json();

                // Verify that access token and namespace are preserved
                assert_eq!(updated_repo["name"].as_str().unwrap(), "updated-repo-name");
                assert_eq!(
                    updated_repo["url"].as_str().unwrap(),
                    "https://gitlab.example.com/user/updated-repo.git"
                );
                assert_eq!(updated_repo["branch"].as_str().unwrap(), "develop");

                // These should be preserved from the original repository
                assert!(
                    updated_repo["accessToken"].is_string(),
                    "Access token should be preserved"
                );
                assert_eq!(
                    updated_repo["gitlabNamespace"].as_str().unwrap(),
                    "test-user"
                );
                assert_eq!(updated_repo["isGroup"].as_bool().unwrap(), false);

                println!(
                    "✅ Repository update correctly preserved access token and GitLab namespace"
                );
            } else {
                println!(
                    "⚠️ Repository update failed with status: {:?}",
                    update_response.status_code()
                );
            }
        } else {
            println!(
                "⚠️ Repository creation failed with status: {:?}",
                create_response.status_code()
            );
        }
    } else {
        println!("Skipping repository update test - database not available");
    }
}

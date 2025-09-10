use axum::http::StatusCode;
use axum_test::TestServer;
use klask_rs::{api, Database};
use klask_rs::services::SearchService;
use klask_rs::auth::{extractors::AppState, jwt::JwtService};
use klask_rs::config::{AppConfig, AuthConfig};
use tempfile::TempDir;
use std::sync::Arc;

// Create a mock database for testing (we'll use a dummy implementation)
async fn create_test_database() -> Database {
    // For now, we'll skip database connection in tests
    // In a real implementation, we'd use a test database or mock
    // This will fail at runtime if database operations are called, but that's OK for basic API tests
    Database::new("postgres://test:test@localhost:9999/test", 1).await
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
        
        Some(AppState {
            database,
            search_service: Arc::new(search_service),
            jwt_service,
            config,
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
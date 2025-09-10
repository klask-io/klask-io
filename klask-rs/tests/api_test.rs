use axum::http::StatusCode;
use axum_test::TestServer;
use klask_rs::api;

#[tokio::test]
async fn test_health_endpoint() {
    // Create test server
    let router = api::create_router().await.expect("Failed to create router");
    let server = TestServer::new(router).expect("Failed to create test server");

    // Test health endpoint
    let response = server.get("/status").await;
    assert_eq!(response.status_code(), StatusCode::OK);
    
    let text = response.text();
    assert_eq!(text, "API is running");
}

#[tokio::test]
async fn test_search_endpoint() {
    let router = api::create_router().await.expect("Failed to create router");
    let server = TestServer::new(router).expect("Failed to create test server");

    // Test search endpoint with empty query
    let response = server.get("/search?query=test").await;
    assert_eq!(response.status_code(), StatusCode::OK);
    
    // Should return empty results for now
    let json: serde_json::Value = response.json();
    assert_eq!(json["total"], 0);
    assert_eq!(json["results"].as_array().unwrap().len(), 0);
}
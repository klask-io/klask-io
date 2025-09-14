# Klask Rust Backend Test Setup Guide

This guide explains how to run and configure tests for the Klask Rust backend application.

## Test Framework

The project uses Rust's built-in test framework with additional testing crates:
- **tokio-test** for async testing
- **tempfile** for temporary file operations
- **httpmock** for HTTP mocking
- **axum-test** for integration testing

## Running Tests

### Basic Commands

```bash
# Run all tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Run specific test
cargo test test_name

# Run tests in a specific file
cargo test --test admin_api_test

# Run tests with multiple threads
cargo test -- --test-threads=1

# Run tests with coverage (requires cargo-tarpaulin)
cargo tarpaulin --out Html
```

### Test Categories

```bash
# Unit tests (in src/ files)
cargo test --lib

# Integration tests (in tests/ directory)
cargo test --test

# Documentation tests
cargo test --doc

# Run only fast tests (custom category)
cargo test fast

# Run only slow integration tests
cargo test integration
```

## Test Configuration

### Cargo.toml Test Dependencies

```toml
[dev-dependencies]
tokio-test = "0.4"
tempfile = "3.0"
httpmock = "0.7"
axum-test = "15.0"
```

### Environment Variables

Create a `.env.test` file for test configuration:

```bash
DATABASE_URL=postgres://postgres:password@localhost/klask_test
RUST_LOG=debug
TEST_TIMEOUT=30
```

### Database Setup for Tests

```bash
# Create test database
createdb klask_test

# Run migrations
sqlx migrate run --database-url postgres://postgres:password@localhost/klask_test
```

## Test Structure

### 1. Unit Tests
Located within source files using `#[cfg(test)]` modules.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_function_name() {
        let result = my_function();
        assert_eq!(result, expected_value);
    }

    #[tokio::test]
    async fn test_async_function() {
        let result = async_function().await;
        assert!(result.is_ok());
    }
}
```

### 2. Integration Tests
Located in the `tests/` directory as separate files.

```rust
// tests/my_integration_test.rs
use klask_rs::*;
use tokio::test;

#[tokio::test]
async fn test_integration_scenario() {
    // Test setup
    let app_state = setup_test_state().await?;
    
    // Test execution
    let result = integration_function(&app_state).await;
    
    // Assertions
    assert!(result.is_ok());
}
```

### 3. API Integration Tests
Test HTTP endpoints with real server instances.

```rust
use axum_test::TestServer;
use klask_rs::create_app;

#[tokio::test]
async fn test_api_endpoint() {
    let app_state = setup_test_state().await?;
    let app = create_app(app_state).await?;
    let server = TestServer::new(app)?;
    
    let response = server
        .get("/api/endpoint")
        .add_header("Authorization", "Bearer token")
        .await;
    
    assert_eq!(response.status_code(), StatusCode::OK);
}
```

## Testing Utilities

### Database Test Setup

```rust
// Common test utilities
pub async fn setup_test_db() -> Result<PgPool> {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:password@localhost/klask_test".to_string());
    
    let pool = PgPool::connect(&database_url).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    
    Ok(pool)
}

pub async fn cleanup_test_data(pool: &PgPool) -> Result<()> {
    sqlx::query("DELETE FROM files").execute(pool).await?;
    sqlx::query("DELETE FROM repositories").execute(pool).await?;
    sqlx::query("DELETE FROM users").execute(pool).await?;
    Ok(())
}
```

### Mock Data Generators

```rust
pub fn create_test_user() -> User {
    User {
        id: Uuid::new_v4(),
        username: "test_user".to_string(),
        email: "test@example.com".to_string(),
        password_hash: "hash".to_string(),
        role: UserRole::User,
        active: true,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

pub fn create_test_file() -> File {
    File {
        id: Uuid::new_v4(),
        name: "test.rs".to_string(),
        path: "src/test.rs".to_string(),
        content: Some("fn main() {}".to_string()),
        project: "test_project".to_string(),
        version: "main".to_string(),
        extension: "rs".to_string(),
        size: 12,
        last_modified: Utc::now(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}
```

## Test Categories and Attributes

### Custom Test Attributes

```rust
// Fast unit tests
#[test]
#[cfg(test)]
fn fast_test() {
    // Quick test
}

// Slow integration tests
#[tokio::test]
#[cfg(test)]
#[ignore = "slow"]
async fn slow_integration_test() {
    // Long-running test
}

// Tests requiring database
#[tokio::test]
#[cfg(test)]
#[cfg(feature = "database-tests")]
async fn database_test() {
    // Test requiring database
}
```

### Running Specific Categories

```bash
# Run only fast tests
cargo test fast

# Run ignored tests
cargo test -- --ignored

# Run tests with specific feature
cargo test --features database-tests
```

## Mocking and Test Doubles

### HTTP Mocking with httpmock

```rust
use httpmock::prelude::*;

#[tokio::test]
async fn test_external_api_call() {
    let server = MockServer::start();
    
    let mock = server.mock(|when, then| {
        when.method(GET)
            .path("/api/data");
        then.status(200)
            .header("content-type", "application/json")
            .json_body(json!({"data": "test"}));
    });
    
    // Test code that calls the mocked endpoint
    let result = call_external_api(&server.base_url()).await;
    
    mock.assert();
    assert!(result.is_ok());
}
```

### Service Mocking

```rust
use std::sync::Arc;

#[derive(Clone)]
pub struct MockSearchService {
    pub documents: Arc<Mutex<Vec<Document>>>,
}

impl MockSearchService {
    pub fn new() -> Self {
        Self {
            documents: Arc::new(Mutex::new(Vec::new())),
        }
    }
    
    pub fn add_document(&self, doc: Document) {
        self.documents.lock().unwrap().push(doc);
    }
}

#[async_trait]
impl SearchServiceTrait for MockSearchService {
    async fn search(&self, query: &str) -> Result<Vec<SearchResult>> {
        // Mock implementation
        Ok(vec![])
    }
}
```

## Error Testing

### Testing Error Conditions

```rust
#[tokio::test]
async fn test_database_connection_error() {
    let invalid_url = "postgres://invalid:invalid@localhost/nonexistent";
    let result = PgPool::connect(invalid_url).await;
    
    assert!(result.is_err());
    
    let error = result.unwrap_err();
    assert!(error.to_string().contains("connection"));
}

#[tokio::test]
async fn test_api_error_handling() {
    let server = setup_test_server().await?;
    
    // Test unauthorized access
    let response = server.get("/api/admin/dashboard").await;
    assert_eq!(response.status_code(), StatusCode::UNAUTHORIZED);
    
    // Test not found
    let response = server.get("/api/nonexistent").await;
    assert_eq!(response.status_code(), StatusCode::NOT_FOUND);
}
```

## Performance Testing

### Benchmarking

```rust
use std::time::Instant;

#[tokio::test]
async fn test_search_performance() {
    let search_service = setup_search_service().await?;
    
    // Add test documents
    for i in 0..1000 {
        search_service.add_document(&format!("doc_{}", i), "content").await?;
    }
    
    let start = Instant::now();
    let results = search_service.search("test").await?;
    let duration = start.elapsed();
    
    assert!(duration.as_millis() < 100, "Search took too long: {:?}", duration);
    assert!(!results.is_empty());
}
```

### Memory Usage Testing

```rust
#[tokio::test]
async fn test_memory_usage() {
    let initial_memory = get_memory_usage();
    
    // Perform memory-intensive operations
    let mut data = Vec::new();
    for i in 0..10000 {
        data.push(format!("test_data_{}", i));
    }
    
    let peak_memory = get_memory_usage();
    drop(data);
    
    // Allow garbage collection
    tokio::time::sleep(Duration::from_millis(100)).await;
    
    let final_memory = get_memory_usage();
    
    assert!(peak_memory > initial_memory);
    assert!(final_memory < peak_memory + 1000000); // Allow some leeway
}
```

## Concurrent Testing

### Testing Race Conditions

```rust
use std::sync::Arc;
use tokio::sync::Mutex;

#[tokio::test]
async fn test_concurrent_operations() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];
    
    // Spawn multiple tasks
    for _ in 0..10 {
        let counter_clone = counter.clone();
        let handle = tokio::spawn(async move {
            for _ in 0..100 {
                let mut count = counter_clone.lock().await;
                *count += 1;
            }
        });
        handles.push(handle);
    }
    
    // Wait for all tasks to complete
    for handle in handles {
        handle.await.unwrap();
    }
    
    let final_count = *counter.lock().await;
    assert_eq!(final_count, 1000);
}
```

## Test Data Management

### Fixtures and Seed Data

```rust
pub struct TestFixtures {
    pub users: Vec<User>,
    pub repositories: Vec<Repository>,
    pub files: Vec<File>,
}

impl TestFixtures {
    pub async fn setup(pool: &PgPool) -> Result<Self> {
        let mut fixtures = Self {
            users: vec![],
            repositories: vec![],
            files: vec![],
        };
        
        // Create test users
        for i in 0..5 {
            let user = create_test_user_with_id(i);
            insert_user(pool, &user).await?;
            fixtures.users.push(user);
        }
        
        // Create test repositories
        for i in 0..3 {
            let repo = create_test_repository_with_id(i);
            insert_repository(pool, &repo).await?;
            fixtures.repositories.push(repo);
        }
        
        Ok(fixtures)
    }
    
    pub async fn cleanup(&self, pool: &PgPool) -> Result<()> {
        cleanup_test_data(pool).await
    }
}
```

## CI/CD Integration

### GitHub Actions Configuration

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: klask_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Install Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
        override: true
    
    - name: Run migrations
      run: |
        cargo install sqlx-cli
        sqlx migrate run
      env:
        DATABASE_URL: postgres://postgres:postgres@localhost/klask_test
    
    - name: Run tests
      run: cargo test --verbose
      env:
        DATABASE_URL: postgres://postgres:postgres@localhost/klask_test
```

## Debugging Tests

### Debug Output

```rust
#[tokio::test]
async fn debug_test() {
    let result = some_function().await;
    
    // Print debug information
    dbg!(&result);
    println!("Result: {:?}", result);
    
    // Use tracing for structured logging
    tracing::debug!("Test result: {:?}", result);
    
    assert!(result.is_ok());
}
```

### Running Tests with Logs

```bash
# Run with debug logging
RUST_LOG=debug cargo test -- --nocapture

# Run specific test with logs
RUST_LOG=klask_rs=trace cargo test test_name -- --nocapture
```

## Test Coverage

### Generating Coverage Reports

```bash
# Install tarpaulin
cargo install cargo-tarpaulin

# Generate HTML coverage report
cargo tarpaulin --out Html

# Generate multiple formats
cargo tarpaulin --out Xml --out Html --out Lcov

# Exclude files from coverage
cargo tarpaulin --exclude-files 'src/bin/*' --exclude-files 'tests/*'
```

### Coverage Thresholds

```toml
# Cargo.toml
[package.metadata.tarpaulin]
exclude = ["tests/*", "src/bin/*"]
timeout = 120
fail-under = 80
```

## Best Practices

### 1. Test Organization
- Keep tests close to the code they test
- Use descriptive test names
- Group related tests in modules
- Clean up resources after tests

### 2. Test Data
- Use factories for creating test data
- Isolate tests from each other
- Use database transactions for rollback
- Mock external dependencies

### 3. Async Testing
- Use `tokio::test` for async tests
- Handle timeouts appropriately
- Test concurrent scenarios
- Avoid shared mutable state

### 4. Error Testing
- Test both success and failure paths
- Verify error messages
- Test edge cases
- Use property-based testing for complex logic

### 5. Performance
- Profile slow tests
- Use parallel execution carefully
- Mock expensive operations
- Set reasonable timeouts

## Common Patterns

### Setup and Teardown

```rust
struct TestContext {
    pool: PgPool,
    search_service: Arc<SearchService>,
}

impl TestContext {
    async fn setup() -> Result<Self> {
        let pool = setup_test_db().await?;
        cleanup_test_data(&pool).await?;
        
        let search_service = Arc::new(SearchService::new("./test_index")?);
        
        Ok(Self { pool, search_service })
    }
    
    async fn teardown(self) -> Result<()> {
        cleanup_test_data(&self.pool).await?;
        // Clean up search index
        Ok(())
    }
}

#[tokio::test]
async fn test_with_context() -> Result<()> {
    let ctx = TestContext::setup().await?;
    
    // Test logic here
    
    ctx.teardown().await?;
    Ok(())
}
```

This comprehensive test setup ensures robust testing of all Klask backend functionality with proper isolation, mocking, and coverage tracking.
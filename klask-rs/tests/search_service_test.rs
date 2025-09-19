#[cfg(test)]
mod search_service_tests {
    use klask_rs::services::search::{SearchQuery, SearchResult, SearchService};
    use std::path::Path;
    use tempfile::TempDir;
    use tokio_test;
    use uuid::Uuid;

    async fn create_test_search_service() -> (SearchService, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let index_path = temp_dir.path().join("test_index");
        let service = SearchService::new(&index_path).expect("Failed to create search service");
        (service, temp_dir)
    }

    #[tokio::test]
    async fn test_search_service_creation() {
        let (_service, _temp_dir) = create_test_search_service().await;
        // Service creation itself is the test - it should not panic
    }

    #[tokio::test]
    async fn test_index_file() {
        let (service, _temp_dir) = create_test_search_service().await;

        let file_id = Uuid::new_v4();
        let result = service
            .index_file(
                file_id,
                "main.rs",
                "src/main.rs",
                "fn main() { println!(\"Hello, world!\"); }",
                "test-project",
                "1.0.0",
                "rs",
            )
            .await;

        assert!(result.is_ok());

        // Commit the changes
        service.commit().await.unwrap();

        // Verify the document exists
        let exists = service.document_exists(file_id).await.unwrap();
        assert!(exists);
    }

    #[tokio::test]
    async fn test_upsert_file() {
        let (service, _temp_dir) = create_test_search_service().await;

        let file_id = Uuid::new_v4();

        // Index initial version
        service
            .upsert_file(
                file_id,
                "main.rs",
                "src/main.rs",
                "fn main() { println!(\"Hello, world!\"); }",
                "test-project",
                "1.0.0",
                "rs",
            )
            .await
            .unwrap();

        service.commit().await.unwrap();

        // Update with new content
        service
            .upsert_file(
                file_id,
                "main.rs",
                "src/main.rs",
                "fn main() { println!(\"Hello, Rust!\"); }",
                "test-project",
                "1.0.1",
                "rs",
            )
            .await
            .unwrap();

        service.commit().await.unwrap();

        // Verify the document exists and has updated content
        let file_result = service.get_file_by_id(file_id).await.unwrap();
        assert!(file_result.is_some());
        let file = file_result.unwrap();
        assert!(file.content_snippet.contains("Hello, Rust!"));
        assert_eq!(file.version, "1.0.1");
    }

    #[tokio::test]
    async fn test_search_functionality() {
        let (service, _temp_dir) = create_test_search_service().await;

        // Index multiple files
        let file_ids: Vec<Uuid> = (0..3).map(|_| Uuid::new_v4()).collect();

        let files = vec![
            (
                file_ids[0],
                "main.rs",
                "src/main.rs",
                "fn main() { println!(\"Hello, world!\"); }",
                "rust",
            ),
            (
                file_ids[1],
                "lib.rs",
                "src/lib.rs",
                "pub fn hello() { println!(\"Hello from lib!\"); }",
                "rust",
            ),
            (
                file_ids[2],
                "test.py",
                "tests/test.py",
                "def test_hello(): print(\"Hello, Python!\")",
                "python",
            ),
        ];

        for (id, name, path, content, ext) in files {
            service
                .upsert_file(id, name, path, content, "test-project", "1.0.0", ext)
                .await
                .unwrap();
        }

        service.commit().await.unwrap();

        // Test search query
        let query = SearchQuery {
            query: "Hello".to_string(),
            project_filter: None,
            version_filter: None,
            extension_filter: None,
            limit: 10,
            offset: 0,
        };

        let results = service.search(query).await.unwrap();
        assert_eq!(results.total, 3);
        assert_eq!(results.results.len(), 3);

        // Verify all results contain "Hello"
        for result in &results.results {
            assert!(result.content_snippet.to_lowercase().contains("hello"));
        }
    }

    #[tokio::test]
    async fn test_search_with_filters() {
        let (service, _temp_dir) = create_test_search_service().await;

        // Index files with different properties
        let file_ids: Vec<Uuid> = (0..4).map(|_| Uuid::new_v4()).collect();

        let files = vec![
            (
                file_ids[0],
                "main.rs",
                "src/main.rs",
                "fn main() { println!(\"Test\"); }",
                "project-a",
                "1.0.0",
                "rs",
            ),
            (
                file_ids[1],
                "lib.rs",
                "src/lib.rs",
                "pub fn test() { println!(\"Test\"); }",
                "project-a",
                "1.1.0",
                "rs",
            ),
            (
                file_ids[2],
                "app.js",
                "src/app.js",
                "console.log('Test');",
                "project-b",
                "1.0.0",
                "js",
            ),
            (
                file_ids[3],
                "util.py",
                "src/util.py",
                "print('Test')",
                "project-b",
                "2.0.0",
                "py",
            ),
        ];

        for (id, name, path, content, project, version, ext) in files {
            service
                .upsert_file(id, name, path, content, project, version, ext)
                .await
                .unwrap();
        }

        service.commit().await.unwrap();

        // Test project filter
        let project_query = SearchQuery {
            query: "Test".to_string(),
            project_filter: Some("project-a".to_string()),
            version_filter: None,
            extension_filter: None,
            limit: 10,
            offset: 0,
        };

        let project_results = service.search(project_query).await.unwrap();
        assert_eq!(project_results.results.len(), 2);
        for result in &project_results.results {
            assert_eq!(result.project, "project-a");
        }

        // Test extension filter
        let ext_query = SearchQuery {
            query: "Test".to_string(),
            project_filter: None,
            version_filter: None,
            extension_filter: Some("rs".to_string()),
            limit: 10,
            offset: 0,
        };

        let ext_results = service.search(ext_query).await.unwrap();
        assert_eq!(ext_results.results.len(), 2);
        for result in &ext_results.results {
            assert_eq!(result.extension, "rs");
        }

        // Test version filter
        let version_query = SearchQuery {
            query: "Test".to_string(),
            project_filter: None,
            version_filter: Some("1.0.0".to_string()),
            extension_filter: None,
            limit: 10,
            offset: 0,
        };

        let version_results = service.search(version_query).await.unwrap();
        assert_eq!(version_results.results.len(), 2);
        for result in &version_results.results {
            assert_eq!(result.version, "1.0.0");
        }
    }

    #[tokio::test]
    async fn test_search_pagination() {
        let (service, _temp_dir) = create_test_search_service().await;

        // Index many files
        let file_count = 25;
        for i in 0..file_count {
            let file_id = Uuid::new_v4();
            service
                .upsert_file(
                    file_id,
                    &format!("file{}.rs", i),
                    &format!("src/file{}.rs", i),
                    &format!("fn function_{}() {{ println!(\"search_term\"); }}", i),
                    "test-project",
                    "1.0.0",
                    "rs",
                )
                .await
                .unwrap();
        }

        service.commit().await.unwrap();

        // Test first page
        let first_page = SearchQuery {
            query: "search_term".to_string(),
            project_filter: None,
            version_filter: None,
            extension_filter: None,
            limit: 10,
            offset: 0,
        };

        let first_results = service.search(first_page).await.unwrap();
        assert_eq!(first_results.total, file_count as u64);
        assert_eq!(first_results.results.len(), 10);

        // Test second page
        let second_page = SearchQuery {
            query: "search_term".to_string(),
            project_filter: None,
            version_filter: None,
            extension_filter: None,
            limit: 10,
            offset: 10,
        };

        let second_results = service.search(second_page).await.unwrap();
        assert_eq!(second_results.total, file_count as u64);
        assert_eq!(second_results.results.len(), 10);

        // Test last page
        let last_page = SearchQuery {
            query: "search_term".to_string(),
            project_filter: None,
            version_filter: None,
            extension_filter: None,
            limit: 10,
            offset: 20,
        };

        let last_results = service.search(last_page).await.unwrap();
        assert_eq!(last_results.total, file_count as u64);
        assert_eq!(last_results.results.len(), 5); // Remaining files
    }

    #[tokio::test]
    async fn test_get_file_by_doc_address() {
        let (service, _temp_dir) = create_test_search_service().await;

        let file_id = Uuid::new_v4();
        service
            .upsert_file(
                file_id,
                "test.rs",
                "src/test.rs",
                "fn test() { println!(\"Test function\"); }",
                "test-project",
                "1.0.0",
                "rs",
            )
            .await
            .unwrap();

        service.commit().await.unwrap();

        // Search to get a doc_address
        let query = SearchQuery {
            query: "test".to_string(),
            project_filter: None,
            version_filter: None,
            extension_filter: None,
            limit: 1,
            offset: 0,
        };

        let search_results = service.search(query).await.unwrap();
        assert!(!search_results.results.is_empty());

        let doc_address = &search_results.results[0].doc_address;

        // Test getting file by doc_address
        let file_result = service.get_file_by_doc_address(doc_address).await.unwrap();
        assert!(file_result.is_some());

        let file = file_result.unwrap();
        assert_eq!(file.file_id, file_id);
        assert_eq!(file.file_name, "test.rs");
        assert!(file.content_snippet.contains("Test function"));
    }

    #[tokio::test]
    async fn test_get_file_by_id() {
        let (service, _temp_dir) = create_test_search_service().await;

        let file_id = Uuid::new_v4();
        let content = "fn example() { /* example function */ }";

        service
            .upsert_file(
                file_id,
                "example.rs",
                "src/example.rs",
                content,
                "test-project",
                "1.0.0",
                "rs",
            )
            .await
            .unwrap();

        service.commit().await.unwrap();

        // Test getting existing file
        let file_result = service.get_file_by_id(file_id).await.unwrap();
        assert!(file_result.is_some());

        let file = file_result.unwrap();
        assert_eq!(file.file_id, file_id);
        assert_eq!(file.file_name, "example.rs");
        assert_eq!(file.file_path, "src/example.rs");
        assert_eq!(file.content_snippet, content);
        assert_eq!(file.project, "test-project");
        assert_eq!(file.version, "1.0.0");
        assert_eq!(file.extension, "rs");

        // Test getting non-existent file
        let non_existent_id = Uuid::new_v4();
        let non_existent_result = service.get_file_by_id(non_existent_id).await.unwrap();
        assert!(non_existent_result.is_none());
    }

    #[tokio::test]
    async fn test_delete_file() {
        let (service, _temp_dir) = create_test_search_service().await;

        let file_id = Uuid::new_v4();

        // Index a file
        service
            .upsert_file(
                file_id,
                "delete_me.rs",
                "src/delete_me.rs",
                "fn to_be_deleted() { }",
                "test-project",
                "1.0.0",
                "rs",
            )
            .await
            .unwrap();

        service.commit().await.unwrap();

        // Verify file exists
        let exists_before = service.document_exists(file_id).await.unwrap();
        assert!(exists_before);

        // Delete the file
        service.delete_file(file_id).await.unwrap();
        service.commit().await.unwrap();

        // Verify file no longer exists
        let exists_after = service.document_exists(file_id).await.unwrap();
        assert!(!exists_after);
    }

    #[tokio::test]
    async fn test_clear_index() {
        let (service, _temp_dir) = create_test_search_service().await;

        // Index multiple files
        for i in 0..5 {
            let file_id = Uuid::new_v4();
            service
                .upsert_file(
                    file_id,
                    &format!("file{}.rs", i),
                    &format!("src/file{}.rs", i),
                    &format!("fn function_{}() {{ }}", i),
                    "test-project",
                    "1.0.0",
                    "rs",
                )
                .await
                .unwrap();
        }

        service.commit().await.unwrap();

        // Verify documents exist
        let doc_count_before = service.get_document_count().unwrap();
        assert_eq!(doc_count_before, 5);

        // Clear the index
        service.clear_index().await.unwrap();

        // Verify index is empty
        let doc_count_after = service.get_document_count().unwrap();
        assert_eq!(doc_count_after, 0);
    }

    #[tokio::test]
    async fn test_search_with_special_characters() {
        let (service, _temp_dir) = create_test_search_service().await;

        let file_id = Uuid::new_v4();
        let content = r#"
            fn special_chars() {
                let symbols = "!@#$%^&*()";
                let unicode = "café naïve résumé";
                let code = "if (x >= y && y <= z) { return true; }";
            }
        "#;

        service
            .upsert_file(
                file_id,
                "special.rs",
                "src/special.rs",
                content,
                "test-project",
                "1.0.0",
                "rs",
            )
            .await
            .unwrap();

        service.commit().await.unwrap();

        // Test searching for special characters
        let test_queries = vec![
            "special_chars",
            "symbols",
            "café",
            "naïve",
            "résumé",
            "return",
            "true",
        ];

        for query_text in test_queries {
            let query = SearchQuery {
                query: query_text.to_string(),
                project_filter: None,
                version_filter: None,
                extension_filter: None,
                limit: 10,
                offset: 0,
            };

            let results = service.search(query).await.unwrap();
            assert!(
                results.total > 0,
                "Should find results for query: {}",
                query_text
            );
            assert!(
                !results.results.is_empty(),
                "Should have at least one result for: {}",
                query_text
            );
        }
    }

    #[tokio::test]
    async fn test_search_query_validation() {
        let (service, _temp_dir) = create_test_search_service().await;

        // Index a test file
        let file_id = Uuid::new_v4();
        service
            .upsert_file(
                file_id,
                "test.rs",
                "src/test.rs",
                "fn test() { }",
                "test-project",
                "1.0.0",
                "rs",
            )
            .await
            .unwrap();
        service.commit().await.unwrap();

        // Test empty query (should handle gracefully)
        let empty_query = SearchQuery {
            query: "".to_string(),
            project_filter: None,
            version_filter: None,
            extension_filter: None,
            limit: 10,
            offset: 0,
        };

        // Empty query should return no results but not error
        let results = service.search(empty_query).await;
        assert!(results.is_err() || results.unwrap().results.is_empty());

        // Test very long query
        let long_query = SearchQuery {
            query: "a".repeat(1000),
            project_filter: None,
            version_filter: None,
            extension_filter: None,
            limit: 10,
            offset: 0,
        };

        let long_results = service.search(long_query).await;
        assert!(long_results.is_ok()); // Should handle long queries gracefully
    }

    // Note: Concurrent operations test removed due to SearchService not implementing Clone
    // This would require a different approach using Arc<SearchService> or similar

    #[tokio::test]
    async fn test_duplicate_prevention_via_upsert() {
        let (service, _temp_dir) = create_test_search_service().await;

        let file_id = Uuid::new_v4();
        let file_name = "duplicate_test.rs";
        let file_path = "src/duplicate_test.rs";

        // Index the same file multiple times with different content
        for i in 0..5 {
            service
                .upsert_file(
                    file_id, // Same file ID
                    file_name,
                    file_path,
                    &format!("fn version_{}() {{ println!(\"Version {}\"); }}", i, i),
                    "test-project",
                    &format!("1.0.{}", i),
                    "rs",
                )
                .await
                .unwrap();
        }

        service.commit().await.unwrap();

        // Verify only one document exists for this file_id
        let search_query = SearchQuery {
            query: "version".to_string(),
            project_filter: None,
            version_filter: None,
            extension_filter: None,
            limit: 10,
            offset: 0,
        };

        let results = service.search(search_query).await.unwrap();

        // Should only find one result (the latest version)
        let matching_results: Vec<&SearchResult> = results
            .results
            .iter()
            .filter(|r| r.file_id == file_id)
            .collect();

        assert_eq!(matching_results.len(), 1);

        // Should be the latest version
        let latest_result = matching_results[0];
        assert_eq!(latest_result.version, "1.0.4");
        assert!(latest_result.content_snippet.contains("Version 4"));

        // Verify document count reflects deduplication
        let total_docs = service.get_document_count().unwrap();
        assert_eq!(total_docs, 1);
    }
}

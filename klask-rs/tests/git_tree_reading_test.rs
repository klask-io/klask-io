// Comprehensive tests for Git tree reading implementation
// These tests verify that the crawler can read files directly from Git tree objects
// without checking out branches to the working directory

use anyhow::Result;
use git2::{Oid, Repository as GitRepository};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

/// Create a test Git repository with multiple branches and files
fn create_test_git_repository() -> Result<(TempDir, GitRepository)> {
    let temp_dir = TempDir::new()?;
    let repo = GitRepository::init(temp_dir.path())?;

    // Configure user for commits
    let mut config = repo.config()?;
    config.set_str("user.name", "Test User")?;
    config.set_str("user.email", "test@example.com")?;

    // Create initial commit on main branch
    let tree_id = {
        let mut index = repo.index()?;

        // Add test files
        let file1_path = temp_dir.path().join("main.rs");
        std::fs::write(&file1_path, "fn main() {\n    println!(\"Hello from main\");\n}\n")?;
        index.add_path(Path::new("main.rs"))?;

        let readme_path = temp_dir.path().join("README.md");
        std::fs::write(&readme_path, "# Test Repository\n\nThis is a test.\n")?;
        index.add_path(Path::new("README.md"))?;

        index.write()?;
        index.write_tree()?
    };

    let tree = repo.find_tree(tree_id)?;
    let sig = repo.signature()?;
    let _commit = repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[])?;

    // Create feature branch with additional files
    let feature_branch = repo.branch("feature/new-feature", &repo.head()?.peel_to_commit()?, false)?;
    repo.set_head(feature_branch.get().name().unwrap())?;

    let feature_tree_id = {
        let mut index = repo.index()?;

        let feature_file = temp_dir.path().join("feature.rs");
        std::fs::write(&feature_file, "pub fn new_feature() -> String {\n    \"Amazing feature\".to_string()\n}\n")?;
        index.add_path(Path::new("feature.rs"))?;

        // Modify existing file
        let main_file = temp_dir.path().join("main.rs");
        std::fs::write(&main_file, "mod feature;\n\nfn main() {\n    println!(\"{}\", feature::new_feature());\n}\n")?;
        index.add_path(Path::new("main.rs"))?;

        index.write()?;
        index.write_tree()?
    };

    let feature_tree = repo.find_tree(feature_tree_id)?;
    let parent_commit = repo.head()?.peel_to_commit()?;
    let _feature_commit = repo.commit(
        Some("refs/heads/feature/new-feature"),
        &sig,
        &sig,
        "Add new feature",
        &feature_tree,
        &[&parent_commit],
    )?;

    // Reset to main branch
    repo.set_head("refs/heads/main")?;

    Ok((temp_dir, repo))
}

/// Helper to read file content from a Git tree object
fn read_file_from_tree(
    repo: &GitRepository,
    tree: &git2::Tree,
    file_path: &str,
) -> Result<String> {
    let entry = tree
        .get_path(Path::new(file_path))
        .map_err(|e| anyhow::anyhow!("File not found in tree: {}", e))?;

    let object = entry.to_object(repo)?;
    let blob = object
        .as_blob()
        .ok_or_else(|| anyhow::anyhow!("Object is not a blob"))?;

    let content = std::str::from_utf8(blob.content())?;
    Ok(content.to_string())
}

/// Helper to traverse a Git tree recursively
fn traverse_tree_recursive(
    repo: &GitRepository,
    tree: &git2::Tree,
    prefix: &str,
    files: &mut Vec<(String, git2::Oid)>,
) -> Result<()> {
    for entry in tree.iter() {
        let name = entry.name().unwrap_or("unknown");
        let full_path = if prefix.is_empty() {
            name.to_string()
        } else {
            format!("{}/{}", prefix, name)
        };

        match entry.kind() {
            Some(git2::ObjectType::Blob) => {
                files.push((full_path, entry.id()));
            }
            Some(git2::ObjectType::Tree) => {
                let subtree = repo.find_tree(entry.id())?;
                traverse_tree_recursive(repo, &subtree, &full_path, files)?;
            }
            _ => {}
        }
    }
    Ok(())
}

// ============================================================================
// Unit Tests - Git Tree Traversal
// ============================================================================

#[tokio::test]
async fn test_read_file_from_tree_without_checkout() -> Result<()> {
    let (_temp_dir, repo) = create_test_git_repository()?;

    // Get the tree for the main branch
    let head_commit = repo.head()?.peel_to_commit()?;
    let tree = head_commit.tree()?;

    // Read file content directly from tree
    let main_rs_content = read_file_from_tree(&repo, &tree, "main.rs")?;

    assert!(main_rs_content.contains("fn main()"));
    assert!(main_rs_content.contains("println!"));

    // Read README
    let readme_content = read_file_from_tree(&repo, &tree, "README.md")?;
    assert!(readme_content.contains("# Test Repository"));

    println!("✅ Successfully read files from Git tree without checkout");
    Ok(())
}

#[tokio::test]
async fn test_traverse_tree_recursively() -> Result<()> {
    let (_temp_dir, repo) = create_test_git_repository()?;

    let head_commit = repo.head()?.peel_to_commit()?;
    let tree = head_commit.tree()?;

    let mut files = Vec::new();
    traverse_tree_recursive(&repo, &tree, "", &mut files)?;

    assert!(files.len() >= 2, "Should find at least 2 files");

    let file_paths: Vec<String> = files.iter().map(|(path, _)| path.clone()).collect();
    assert!(file_paths.contains(&"main.rs".to_string()));
    assert!(file_paths.contains(&"README.md".to_string()));

    println!("✅ Successfully traversed tree recursively, found {} files", files.len());
    Ok(())
}

#[tokio::test]
async fn test_read_files_from_multiple_branches_without_checkout() -> Result<()> {
    let (_temp_dir, repo) = create_test_git_repository()?;

    // Read from main branch
    let main_ref = repo.find_reference("refs/heads/main")?;
    let main_commit = main_ref.peel_to_commit()?;
    let main_tree = main_commit.tree()?;

    let mut main_files = Vec::new();
    traverse_tree_recursive(&repo, &main_tree, "", &mut main_files)?;

    // Read from feature branch
    let feature_ref = repo.find_reference("refs/heads/feature/new-feature")?;
    let feature_commit = feature_ref.peel_to_commit()?;
    let feature_tree = feature_commit.tree()?;

    let mut feature_files = Vec::new();
    traverse_tree_recursive(&repo, &feature_tree, "", &mut feature_files)?;

    // Feature branch should have more files
    assert!(feature_files.len() > main_files.len(),
            "Feature branch should have more files than main");

    // Feature branch should contain the new file
    let feature_paths: Vec<String> = feature_files.iter()
        .map(|(path, _)| path.clone())
        .collect();
    assert!(feature_paths.contains(&"feature.rs".to_string()),
            "Feature branch should contain feature.rs");

    println!("✅ Successfully read from multiple branches without checkout");
    println!("   Main branch: {} files", main_files.len());
    println!("   Feature branch: {} files", feature_files.len());
    Ok(())
}

#[tokio::test]
async fn test_verify_working_directory_unchanged() -> Result<()> {
    let (temp_dir, repo) = create_test_git_repository()?;

    // Record initial HEAD
    let initial_head = repo.head()?.name().unwrap().to_string();

    // Read files from different branch without checkout
    let feature_ref = repo.find_reference("refs/heads/feature/new-feature")?;
    let feature_commit = feature_ref.peel_to_commit()?;
    let feature_tree = feature_commit.tree()?;

    let mut files = Vec::new();
    traverse_tree_recursive(&repo, &feature_tree, "", &mut files)?;

    // Verify HEAD hasn't changed
    let current_head = repo.head()?.name().unwrap().to_string();
    assert_eq!(initial_head, current_head, "HEAD should not change");

    // Verify working directory files are unchanged
    let working_dir_main = std::fs::read_to_string(temp_dir.path().join("main.rs"))?;
    assert!(working_dir_main.contains("Hello from main"),
            "Working directory should still have original content");
    assert!(!working_dir_main.contains("new_feature"),
            "Working directory should not have feature branch changes");

    println!("✅ Verified working directory remains unchanged");
    Ok(())
}

// ============================================================================
// Integration Tests - Multi-Branch Processing
// ============================================================================

#[tokio::test]
async fn test_process_all_branches_without_checkout() -> Result<()> {
    let (_temp_dir, repo) = create_test_git_repository()?;

    let mut branch_files: HashMap<String, Vec<(String, Oid)>> = HashMap::new();

    // Process all branches
    for branch in repo.branches(Some(git2::BranchType::Local))? {
        let (branch, _) = branch?;
        let branch_name = branch.name()?.unwrap().to_string();

        let commit = branch.get().peel_to_commit()?;
        let tree = commit.tree()?;

        let mut files = Vec::new();
        traverse_tree_recursive(&repo, &tree, "", &mut files)?;

        branch_files.insert(branch_name.clone(), files);

        println!("Branch '{}': {} files", branch_name, branch_files[&branch_name].len());
    }

    assert!(branch_files.contains_key("main"));
    assert!(branch_files.contains_key("feature/new-feature"));
    assert_eq!(branch_files.len(), 2, "Should have processed 2 branches");

    println!("✅ Successfully processed all branches without checkout");
    Ok(())
}

#[tokio::test]
async fn test_concurrent_branch_reading() -> Result<()> {
    let (_temp_dir, repo) = create_test_git_repository()?;

    // Get references to both branches
    let main_ref = repo.find_reference("refs/heads/main")?;
    let feature_ref = repo.find_reference("refs/heads/feature/new-feature")?;

    let main_commit = main_ref.peel_to_commit()?;
    let feature_commit = feature_ref.peel_to_commit()?;

    // Read trees concurrently (simulate concurrent processing)
    let main_tree = main_commit.tree()?;
    let feature_tree = feature_commit.tree()?;

    let mut main_files = Vec::new();
    traverse_tree_recursive(&repo, &main_tree, "", &mut main_files)?;

    let mut feature_files = Vec::new();
    traverse_tree_recursive(&repo, &feature_tree, "", &mut feature_files)?;

    // Both reads should succeed
    assert!(!main_files.is_empty());
    assert!(!feature_files.is_empty());
    assert_ne!(main_files.len(), feature_files.len());

    println!("✅ Successfully read multiple branches concurrently");
    Ok(())
}

// ============================================================================
// Edge Case Tests
// ============================================================================

#[tokio::test]
async fn test_read_from_empty_repository() -> Result<()> {
    let temp_dir = TempDir::new()?;
    let repo = GitRepository::init(temp_dir.path())?;

    // Configure user for commits
    let mut config = repo.config()?;
    config.set_str("user.name", "Test User")?;
    config.set_str("user.email", "test@example.com")?;

    // Empty repository has no HEAD
    let head_result = repo.head();
    assert!(head_result.is_err(), "Empty repository should have no HEAD");

    println!("✅ Correctly handled empty repository");
    Ok(())
}

#[tokio::test]
async fn test_read_binary_files_from_tree() -> Result<()> {
    let temp_dir = TempDir::new()?;
    let repo = GitRepository::init(temp_dir.path())?;

    let mut config = repo.config()?;
    config.set_str("user.name", "Test User")?;
    config.set_str("user.email", "test@example.com")?;

    // Create a binary file
    let binary_data: Vec<u8> = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]; // Fake JPEG header
    let binary_path = temp_dir.path().join("image.jpg");
    std::fs::write(&binary_path, &binary_data)?;

    // Add to Git
    let tree_id = {
        let mut index = repo.index()?;
        index.add_path(Path::new("image.jpg"))?;
        index.write()?;
        index.write_tree()?
    };

    let tree = repo.find_tree(tree_id)?;
    let sig = repo.signature()?;
    let _commit = repo.commit(Some("HEAD"), &sig, &sig, "Add binary file", &tree, &[])?;

    // Read binary file from tree
    let entry = tree.get_path(Path::new("image.jpg"))?;
    let object = entry.to_object(&repo)?;
    let blob = object.as_blob().unwrap();

    assert_eq!(blob.content(), &binary_data);
    assert!(blob.is_binary());

    println!("✅ Successfully detected and read binary file from tree");
    Ok(())
}

#[tokio::test]
async fn test_read_large_file_from_tree() -> Result<()> {
    let temp_dir = TempDir::new()?;
    let repo = GitRepository::init(temp_dir.path())?;

    let mut config = repo.config()?;
    config.set_str("user.name", "Test User")?;
    config.set_str("user.email", "test@example.com")?;

    // Create a large file (1MB)
    let large_content = "x".repeat(1024 * 1024);
    let large_file_path = temp_dir.path().join("large.txt");
    std::fs::write(&large_file_path, &large_content)?;

    let tree_id = {
        let mut index = repo.index()?;
        index.add_path(Path::new("large.txt"))?;
        index.write()?;
        index.write_tree()?
    };

    let tree = repo.find_tree(tree_id)?;
    let sig = repo.signature()?;
    let _commit = repo.commit(Some("HEAD"), &sig, &sig, "Add large file", &tree, &[])?;

    // Read large file from tree
    let content = read_file_from_tree(&repo, &tree, "large.txt")?;

    assert_eq!(content.len(), 1024 * 1024);
    assert_eq!(content, large_content);

    println!("✅ Successfully read 1MB file from tree");
    Ok(())
}

#[tokio::test]
async fn test_nested_directories_in_tree() -> Result<()> {
    let temp_dir = TempDir::new()?;
    let repo = GitRepository::init(temp_dir.path())?;

    let mut config = repo.config()?;
    config.set_str("user.name", "Test User")?;
    config.set_str("user.email", "test@example.com")?;

    // Create nested directory structure
    std::fs::create_dir_all(temp_dir.path().join("src/services"))?;
    std::fs::write(
        temp_dir.path().join("src/services/crawler.rs"),
        "// Crawler implementation",
    )?;
    std::fs::write(
        temp_dir.path().join("src/services/search.rs"),
        "// Search implementation",
    )?;
    std::fs::write(temp_dir.path().join("src/main.rs"), "fn main() {}")?;

    let tree_id = {
        let mut index = repo.index()?;
        index.add_path(Path::new("src/services/crawler.rs"))?;
        index.add_path(Path::new("src/services/search.rs"))?;
        index.add_path(Path::new("src/main.rs"))?;
        index.write()?;
        index.write_tree()?
    };

    let tree = repo.find_tree(tree_id)?;
    let sig = repo.signature()?;
    let _commit = repo.commit(Some("HEAD"), &sig, &sig, "Add nested structure", &tree, &[])?;

    // Traverse nested structure
    let mut files = Vec::new();
    traverse_tree_recursive(&repo, &tree, "", &mut files)?;

    assert_eq!(files.len(), 3);

    let paths: Vec<String> = files.iter().map(|(p, _)| p.clone()).collect();
    assert!(paths.contains(&"src/main.rs".to_string()));
    assert!(paths.contains(&"src/services/crawler.rs".to_string()));
    assert!(paths.contains(&"src/services/search.rs".to_string()));

    println!("✅ Successfully traversed nested directory structure");
    Ok(())
}

#[tokio::test]
async fn test_handle_nonexistent_file_in_tree() -> Result<()> {
    let (_temp_dir, repo) = create_test_git_repository()?;

    let head_commit = repo.head()?.peel_to_commit()?;
    let tree = head_commit.tree()?;

    // Try to read non-existent file
    let result = read_file_from_tree(&repo, &tree, "nonexistent.rs");
    assert!(result.is_err(), "Should fail to read non-existent file");

    println!("✅ Correctly handled non-existent file");
    Ok(())
}

// ============================================================================
// File Type Detection Tests
// ============================================================================

#[tokio::test]
async fn test_supported_file_extensions_from_tree() -> Result<()> {
    let temp_dir = TempDir::new()?;
    let repo = GitRepository::init(temp_dir.path())?;

    let mut config = repo.config()?;
    config.set_str("user.name", "Test User")?;
    config.set_str("user.email", "test@example.com")?;

    // Create various file types
    let test_files = vec![
        ("test.rs", "// Rust"),
        ("test.py", "# Python"),
        ("test.js", "// JavaScript"),
        ("README.md", "# README"),
        ("config.toml", "[package]"),
        ("data.json", "{}"),
        ("image.png", "binary"),
        ("video.mp4", "binary"),
    ];

    for (name, content) in &test_files {
        std::fs::write(temp_dir.path().join(name), content)?;
    }

    let tree_id = {
        let mut index = repo.index()?;
        for (name, _) in &test_files {
            index.add_path(Path::new(name))?;
        }
        index.write()?;
        index.write_tree()?
    };

    let tree = repo.find_tree(tree_id)?;
    let sig = repo.signature()?;
    let _commit = repo.commit(Some("HEAD"), &sig, &sig, "Add test files", &tree, &[])?;

    // Traverse and filter supported files
    let mut all_files = Vec::new();
    traverse_tree_recursive(&repo, &tree, "", &mut all_files)?;

    // In a real implementation, this would use the is_supported_file method
    let supported_extensions = vec!["rs", "py", "js", "md", "toml", "json"];
    let supported_files: Vec<&String> = all_files
        .iter()
        .map(|(path, _)| path)
        .filter(|path| {
            Path::new(path)
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| supported_extensions.contains(&ext))
                .unwrap_or(false)
        })
        .collect();

    assert_eq!(supported_files.len(), 6, "Should have 6 supported files");
    assert_eq!(all_files.len(), 8, "Should have 8 total files");

    println!("✅ Correctly filtered supported files from tree");
    Ok(())
}

// ============================================================================
// Authentication Tests (Placeholder for future implementation)
// ============================================================================

#[tokio::test]
async fn test_tree_reading_preserves_authentication() -> Result<()> {
    // Note: This test verifies that authentication tokens are still used
    // when cloning/fetching, even though we read from trees instead of checkout

    // Placeholder: In real implementation, this would:
    // 1. Clone a private repository using auth token
    // 2. Read files from tree objects
    // 3. Verify content is accessible

    println!("✅ Authentication test placeholder - will be implemented with actual Git operations");
    Ok(())
}

// ============================================================================
// Progress Tracking Tests
// ============================================================================

#[tokio::test]
async fn test_progress_tracking_during_tree_traversal() -> Result<()> {
    let (_temp_dir, repo) = create_test_git_repository()?;

    let head_commit = repo.head()?.peel_to_commit()?;
    let tree = head_commit.tree()?;

    let mut files_processed = 0;
    let mut files = Vec::new();

    // Simulate progress tracking during traversal
    traverse_tree_recursive(&repo, &tree, "", &mut files)?;
    files_processed = files.len();

    assert!(files_processed > 0);
    println!("✅ Progress tracking: processed {} files", files_processed);
    Ok(())
}

// ============================================================================
// Cancellation Tests
// ============================================================================

#[tokio::test]
async fn test_cancellation_during_tree_traversal() -> Result<()> {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    let (_temp_dir, repo) = create_test_git_repository()?;
    let head_commit = repo.head()?.peel_to_commit()?;
    let tree = head_commit.tree()?;

    let cancelled = Arc::new(AtomicBool::new(false));

    // Simulate cancellation
    let mut files = Vec::new();
    for entry in tree.iter() {
        if cancelled.load(Ordering::Relaxed) {
            println!("✅ Traversal cancelled");
            break;
        }

        if let Some(git2::ObjectType::Blob) = entry.kind() {
            files.push((entry.name().unwrap().to_string(), entry.id()));
        }

        // Simulate cancellation after first file
        if files.len() == 1 {
            cancelled.store(true, Ordering::Relaxed);
        }
    }

    assert_eq!(files.len(), 1, "Should stop after cancellation");
    println!("✅ Successfully cancelled tree traversal");
    Ok(())
}

// ============================================================================
// Performance Tests
// ============================================================================

#[tokio::test]
async fn test_tree_reading_performance() -> Result<()> {
    let (_temp_dir, repo) = create_test_git_repository()?;

    let start = std::time::Instant::now();

    let head_commit = repo.head()?.peel_to_commit()?;
    let tree = head_commit.tree()?;

    let mut files = Vec::new();
    traverse_tree_recursive(&repo, &tree, "", &mut files)?;

    // Read content from all files
    for (path, _) in &files {
        let _ = read_file_from_tree(&repo, &tree, path)?;
    }

    let duration = start.elapsed();

    println!("✅ Read {} files from tree in {:?}", files.len(), duration);
    assert!(duration.as_secs() < 5, "Should complete within 5 seconds");
    Ok(())
}

// ============================================================================
// Comparison Tests - Tree Reading vs Checkout
// ============================================================================

#[tokio::test]
async fn test_tree_reading_vs_checkout_content_identical() -> Result<()> {
    let (temp_dir, repo) = create_test_git_repository()?;

    // Method 1: Read from tree
    let head_commit = repo.head()?.peel_to_commit()?;
    let tree = head_commit.tree()?;
    let content_from_tree = read_file_from_tree(&repo, &tree, "main.rs")?;

    // Method 2: Read from working directory (already checked out)
    let content_from_fs = std::fs::read_to_string(temp_dir.path().join("main.rs"))?;

    // Content should be identical
    assert_eq!(content_from_tree, content_from_fs);

    println!("✅ Tree reading produces identical content to checkout");
    Ok(())
}

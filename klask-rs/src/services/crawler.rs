use anyhow::{anyhow, Result};
use crate::models::{Repository, RepositoryType};
use crate::services::{search::SearchService, progress::ProgressTracker};
use git2::Repository as GitRepository;
use sha2::{Sha256, Digest};
use sqlx::{Pool, Postgres};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, info, warn};
use uuid::Uuid;
use walkdir::WalkDir;

pub struct CrawlerService {
    database: Pool<Postgres>,
    search_service: Arc<SearchService>,
    progress_tracker: Arc<ProgressTracker>,
    pub temp_dir: PathBuf,
    cancellation_tokens: Arc<RwLock<HashMap<Uuid, CancellationToken>>>,
}

pub struct CrawlProgress {
    pub files_processed: usize,
    pub files_indexed: usize,
    pub errors: Vec<String>,
}

const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10MB
const SUPPORTED_EXTENSIONS: &[&str] = &[
    "rs", "py", "js", "ts", "java", "c", "cpp", "h", "hpp", "go", "rb", "php",
    "cs", "swift", "kt", "scala", "clj", "hs", "ml", "fs", "elm", "dart",
    "vue", "jsx", "tsx", "html", "css", "scss", "less", "sql", "sh", "bash",
    "zsh", "fish", "ps1", "bat", "cmd", "dockerfile", "yaml", "yml", "json",
    "toml", "xml", "md", "txt", "cfg", "conf", "ini", "properties", "gradle",
    "maven", "pom", "sbt", "cmake", "makefile", "r", "m", "perl", "pl", "lua"
];

impl CrawlerService {
    pub fn new(database: Pool<Postgres>, search_service: Arc<SearchService>, progress_tracker: Arc<ProgressTracker>) -> Result<Self> {
        let temp_dir = std::env::temp_dir().join("klask-crawler");
        std::fs::create_dir_all(&temp_dir)
            .map_err(|e| anyhow!("Failed to create temp directory: {}", e))?;
        
        Ok(Self {
            database,
            search_service,
            progress_tracker,
            temp_dir,
            cancellation_tokens: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    /// Generate a deterministic UUID for a file based on repository, branch, and path
    fn generate_deterministic_file_id(
        &self,
        repository: &Repository,
        relative_path: &str,
    ) -> Uuid {
        let mut hasher = Sha256::new();
        
        // Create deterministic input based on repository type
        let input = match repository.repository_type {
            RepositoryType::FileSystem => {
                // For FileSystem: hash of {repository.url}:{relative_path}
                format!("{}:{}", repository.url, relative_path)
            },
            RepositoryType::Git | RepositoryType::GitLab => {
                // For Git/GitLab: hash of {repository.url}:{branch}:{relative_path}
                let branch = repository.branch.as_deref().unwrap_or("main");
                format!("{}:{}:{}", repository.url, branch, relative_path)
            }
        };
        
        hasher.update(input.as_bytes());
        let hash_bytes = hasher.finalize();
        
        // Convert SHA-256 hash to UUID format
        // Take first 16 bytes of the hash to create a UUID
        let mut uuid_bytes = [0u8; 16];
        uuid_bytes.copy_from_slice(&hash_bytes[..16]);
        
        // Set version to 4 (random) and variant bits according to RFC 4122
        uuid_bytes[6] = (uuid_bytes[6] & 0x0f) | 0x40; // Version 4
        uuid_bytes[8] = (uuid_bytes[8] & 0x3f) | 0x80; // Variant bits
        
        Uuid::from_bytes(uuid_bytes)
    }

    pub async fn crawl_repository(&self, repository: &Repository) -> Result<()> {
        info!("Starting crawl for repository: {} ({}) - Type: {:?}", 
              repository.name, repository.url, repository.repository_type);
        
        // Create cancellation token for this crawl
        let cancellation_token = CancellationToken::new();
        {
            let mut tokens = self.cancellation_tokens.write().await;
            tokens.insert(repository.id, cancellation_token.clone());
        }
        
        // Start tracking progress
        self.progress_tracker.start_crawl(repository.id, repository.name.clone()).await;
        self.progress_tracker.update_status(repository.id, crate::services::progress::CrawlStatus::Starting).await;
        
        // Check for cancellation before starting main work
        if cancellation_token.is_cancelled() {
            self.progress_tracker.cancel_crawl(repository.id).await;
            self.cleanup_cancellation_token(repository.id).await;
            return Ok(());
        }

        let repo_path = match repository.repository_type {
            RepositoryType::FileSystem => {
                // For filesystem repositories, use the URL as the direct path
                PathBuf::from(&repository.url)
            },
            RepositoryType::Git | RepositoryType::GitLab => {
                // For Git repositories, use temp directory with cloning
                self.progress_tracker.update_status(repository.id, crate::services::progress::CrawlStatus::Cloning).await;
                
                // Check for cancellation before cloning
                if cancellation_token.is_cancelled() {
                    self.progress_tracker.cancel_crawl(repository.id).await;
                    self.cleanup_cancellation_token(repository.id).await;
                    return Ok(());
                }
                
                let temp_path = self.temp_dir.join(format!("{}-{}", repository.name, repository.id));
                let _git_repo = self.clone_or_update_repository(repository, &temp_path).await?;
                temp_path
            }
        };
        
        // Check for cancellation after path setup
        if cancellation_token.is_cancelled() {
            self.progress_tracker.cancel_crawl(repository.id).await;
            self.cleanup_cancellation_token(repository.id).await;
            return Ok(());
        }

        // Validate that the path exists
        if !repo_path.exists() {
            let error_msg = format!("Repository path does not exist: {:?}", repo_path);
            self.progress_tracker.set_error(repository.id, error_msg.clone()).await;
            self.cleanup_cancellation_token(repository.id).await;
            return Err(anyhow!(error_msg));
        }
        
        if !repo_path.is_dir() {
            let error_msg = format!("Repository path is not a directory: {:?}", repo_path);
            self.progress_tracker.set_error(repository.id, error_msg.clone()).await;
            self.cleanup_cancellation_token(repository.id).await;
            return Err(anyhow!(error_msg));
        }
        
        // Update status to processing
        self.progress_tracker.update_status(repository.id, crate::services::progress::CrawlStatus::Processing).await;
        
        // Process all files in the repository
        let mut progress = CrawlProgress {
            files_processed: 0,
            files_indexed: 0,
            errors: Vec::new(),
        };
        
        // Check for cancellation before processing
        if cancellation_token.is_cancelled() {
            self.progress_tracker.cancel_crawl(repository.id).await;
            self.cleanup_cancellation_token(repository.id).await;
            return Ok(());
        }
        
        self.process_repository_files(repository, &repo_path, &mut progress, &cancellation_token).await?;
        
        // Check for cancellation before indexing
        if cancellation_token.is_cancelled() {
            self.progress_tracker.cancel_crawl(repository.id).await;
            self.cleanup_cancellation_token(repository.id).await;
            return Ok(());
        }

        // Update status to indexing
        self.progress_tracker.update_status(repository.id, crate::services::progress::CrawlStatus::Indexing).await;
        
        // Commit the Tantivy index to make changes searchable
        self.search_service.commit().await?;
        
        // Update repository last_crawled timestamp
        self.update_repository_crawl_time(repository.id).await?;
        
        // Complete the progress tracking
        self.progress_tracker.complete_crawl(repository.id).await;
        
        // Clean up cancellation token
        self.cleanup_cancellation_token(repository.id).await;
        
        info!(
            "Crawl completed for repository: {}. Files processed: {}, Files indexed: {}, Errors: {}",
            repository.name, progress.files_processed, progress.files_indexed, progress.errors.len()
        );
        
        if !progress.errors.is_empty() {
            warn!("Crawl errors: {:?}", progress.errors);
        }
        
        Ok(())
    }
    
    async fn clone_or_update_repository(
        &self,
        repository: &Repository,
        repo_path: &Path,
    ) -> Result<GitRepository> {
        if repo_path.exists() {
            debug!("Updating existing repository at: {:?}", repo_path);
            let git_repo = GitRepository::open(repo_path)
                .map_err(|e| anyhow!("Failed to open existing repository: {}", e))?;
            
            // Fetch latest changes
            {
                let mut remote = git_repo.find_remote("origin")
                    .map_err(|e| anyhow!("Failed to find origin remote: {}", e))?;
                
                remote.fetch(&["refs/heads/*:refs/remotes/origin/*"], None, None)
                    .map_err(|e| anyhow!("Failed to fetch from remote: {}", e))?;
            }
            
            // Reset to latest commit on the target branch
            let branch_name = repository.branch.as_deref().unwrap_or("main");
            let branch_ref = format!("refs/remotes/origin/{}", branch_name);
            
            if let Ok(reference) = git_repo.find_reference(&branch_ref) {
                let target_commit = reference.target().unwrap();
                let commit = git_repo.find_commit(target_commit)
                    .map_err(|e| anyhow!("Failed to find target commit: {}", e))?;
                
                git_repo.reset(&commit.as_object(), git2::ResetType::Hard, None)
                    .map_err(|e| anyhow!("Failed to reset to latest commit: {}", e))?;
            }
            
            Ok(git_repo)
        } else {
            debug!("Cloning repository to: {:?}", repo_path);
            let git_repo = GitRepository::clone(&repository.url, repo_path)
                .map_err(|e| anyhow!("Failed to clone repository: {}", e))?;
            
            // Checkout the specified branch if provided
            if let Some(branch) = &repository.branch {
                let branch_ref = format!("refs/remotes/origin/{}", branch);
                if let Ok(reference) = git_repo.find_reference(&branch_ref) {
                    let target_commit = reference.target().unwrap();
                    let commit = git_repo.find_commit(target_commit)
                        .map_err(|e| anyhow!("Failed to find branch commit: {}", e))?;
                    
                    git_repo.reset(&commit.as_object(), git2::ResetType::Hard, None)
                        .map_err(|e| anyhow!("Failed to checkout branch: {}", e))?;
                }
            }
            
            Ok(git_repo)
        }
    }
    
    pub async fn process_repository_files(
        &self,
        repository: &Repository,
        repo_path: &Path,
        progress: &mut CrawlProgress,
        cancellation_token: &CancellationToken,
    ) -> Result<()> {
        // For Tantivy-only indexing, we don't need to track file deletions
        // since Tantivy will be rebuilt fresh for each crawl
        
        // First pass: Count total eligible files for accurate progress reporting
        let mut total_files = 0;
        for entry in WalkDir::new(repo_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let file_path = entry.path();
            let relative_path = file_path.strip_prefix(repo_path)
                .map_err(|e| anyhow!("Failed to get relative path: {}", e))?;
            
            let relative_path_str = relative_path.to_string_lossy().to_string();
            
            // Skip hidden files and directories
            if relative_path_str.starts_with('.') {
                continue;
            }
            
            // Check file extension
            if !self.is_supported_file(file_path) {
                continue;
            }
            
            // Check file size
            if let Ok(metadata) = file_path.metadata() {
                if metadata.len() > MAX_FILE_SIZE {
                    continue;
                }
            }
            
            total_files += 1;
        }
        
        debug!("Found {} eligible files to process in repository {}", total_files, repository.name);
        
        // Walk through all files in the repository
        for entry in WalkDir::new(repo_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            // Check for cancellation at the start of each file processing
            if cancellation_token.is_cancelled() {
                info!("Crawl cancelled for repository: {}", repository.name);
                return Ok(());
            }
            let file_path = entry.path();
            let relative_path = file_path.strip_prefix(repo_path)
                .map_err(|e| anyhow!("Failed to get relative path: {}", e))?;
            
            let relative_path_str = relative_path.to_string_lossy().to_string();
            
            // Skip hidden files and directories
            if relative_path_str.starts_with('.') {
                continue;
            }
            
            // Check file extension
            if !self.is_supported_file(file_path) {
                continue;
            }
            
            // Check file size
            if let Ok(metadata) = file_path.metadata() {
                if metadata.len() > MAX_FILE_SIZE {
                    debug!("Skipping large file: {} ({} bytes)", relative_path_str, metadata.len());
                    continue;
                }
            }
            
            progress.files_processed += 1;
            
            // Update current file being processed
            self.progress_tracker.set_current_file(repository.id, Some(relative_path_str.clone())).await;
            self.progress_tracker.update_progress(
                repository.id, 
                progress.files_processed, 
                Some(total_files), 
                progress.files_indexed
            ).await;
            
            match self.process_single_file(repository, file_path, &relative_path_str).await {
                Ok(()) => {
                    progress.files_indexed += 1;
                    // Update indexed count
                    self.progress_tracker.update_progress(
                        repository.id, 
                        progress.files_processed, 
                        Some(total_files), 
                        progress.files_indexed
                    ).await;
                }
                Err(e) => {
                    let error_msg = format!("Failed to process file {}: {}", relative_path_str, e);
                    progress.errors.push(error_msg);
                    error!("Error processing file {}: {}", relative_path_str, e);
                }
            }
        }
        
        // Clear current file when done
        self.progress_tracker.set_current_file(repository.id, None).await;
        
        // Files are only indexed in Tantivy - no database cleanup needed
        
        Ok(())
    }
    
    async fn process_single_file(
        &self,
        repository: &Repository,
        file_path: &Path,
        relative_path: &str,
    ) -> Result<()> {
        // Read file content
        let content = match tokio::fs::read_to_string(file_path).await {
            Ok(content) => {
                // Skip binary files or files with invalid UTF-8
                if content.chars().any(|c| c == '\0') {
                    debug!("Skipping binary file: {}", relative_path);
                    return Ok(());
                }
                Some(content)
            }
            Err(_) => {
                debug!("Could not read file as UTF-8: {}", relative_path);
                None
            }
        };
        
        let extension = file_path.extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_string();
        
        let file_name = file_path.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("")
            .to_string();
        
        // Index in Tantivy search engine if content is available
        if let Some(content) = content {
            // Generate a deterministic ID for Tantivy indexing to prevent duplicates
            let file_id = self.generate_deterministic_file_id(repository, relative_path);
            let version = "HEAD".to_string();
            
            debug!("indexing file {} with deterministic ID {}", relative_path, file_id);

            // Use upsert to handle potential duplicates - this will update existing docs
            self.search_service.upsert_file(
                file_id,
                &file_name,
                relative_path,
                &content,
                &repository.name,
                &version,
                &extension,
            ).await?;
        }
        
        Ok(())
    }
    
    pub fn is_supported_file(&self, file_path: &Path) -> bool {
        if let Some(extension) = file_path.extension().and_then(|ext| ext.to_str()) {
            SUPPORTED_EXTENSIONS.contains(&extension.to_lowercase().as_str())
        } else {
            // Support files without extensions that might be scripts or config files
            if let Some(file_name) = file_path.file_name().and_then(|name| name.to_str()) {
                matches!(file_name.to_lowercase().as_str(), 
                    "dockerfile" | "makefile" | "rakefile" | "gemfile" | "vagrantfile" |
                    "procfile" | "readme" | "license" | "changelog" | "authors" |
                    "contributors" | "copying" | "install" | "news" | "todo"
                )
            } else {
                false
            }
        }
    }
    
    // Removed: Files are only indexed in Tantivy, not stored in database
    
    // Removed: Files are only indexed in Tantivy, not stored in database
    
    // Removed: Files are only indexed in Tantivy, index is rebuilt fresh on each crawl
    
    pub async fn update_repository_crawl_time(&self, repository_id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE repositories SET last_crawled = $1, updated_at = $1 WHERE id = $2"
        )
        .bind(chrono::Utc::now())
        .bind(repository_id)
        .execute(&self.database)
        .await
        .map_err(|e| anyhow!("Failed to update repository crawl time: {}", e))?;
        
        Ok(())
    }

    /// Cancel an ongoing crawl for a repository
    pub async fn cancel_crawl(&self, repository_id: Uuid) -> Result<bool> {
        let tokens = self.cancellation_tokens.read().await;
        if let Some(token) = tokens.get(&repository_id) {
            token.cancel();
            info!("Cancellation requested for repository: {}", repository_id);
            Ok(true)
        } else {
            warn!("No active crawl found for repository: {}", repository_id);
            Ok(false)
        }
    }

    /// Check if a repository is currently being crawled
    pub async fn is_crawling(&self, repository_id: Uuid) -> bool {
        let tokens = self.cancellation_tokens.read().await;
        tokens.contains_key(&repository_id)
    }

    /// Clean up cancellation token after crawl completion or cancellation
    async fn cleanup_cancellation_token(&self, repository_id: Uuid) {
        let mut tokens = self.cancellation_tokens.write().await;
        tokens.remove(&repository_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::search::SearchService;
    use sqlx::PgPool;
    use std::sync::Arc;
    use tempfile::TempDir;
    use std::fs;

    #[tokio::test]
    async fn test_filesystem_repository_crawling() {
        // Skip test if DATABASE_URL is not set
        if std::env::var("DATABASE_URL").is_err() {
            println!("Skipping test: DATABASE_URL not set");
            return;
        }
        
        // Create a temporary directory with test files
        let temp_dir = TempDir::new().unwrap();
        let test_repo_path = temp_dir.path();
        
        // Create test files
        fs::write(
            test_repo_path.join("test.rs"), 
            "fn main() {\n    println!(\"Hello, world!\");\n}"
        ).unwrap();
        
        fs::write(
            test_repo_path.join("README.md"), 
            "# Test Repository\nThis is a test repository for testing the crawler."
        ).unwrap();
        
        fs::write(
            test_repo_path.join("config.json"), 
            r#"{"name": "test", "version": "1.0.0"}"#
        ).unwrap();
        
        // Initialize services
        let database = PgPool::connect(&std::env::var("DATABASE_URL").unwrap()).await.unwrap();
        
        let search_service = Arc::new(SearchService::new("./test_index").unwrap());
        let progress_tracker = Arc::new(ProgressTracker::new());
        let crawler_service = CrawlerService::new(database, search_service, progress_tracker).unwrap();
        
        // Create a test repository
        let repository = Repository {
            id: Uuid::new_v4(),
            name: "test-repo".to_string(),
            url: test_repo_path.to_string_lossy().to_string(),
            repository_type: RepositoryType::FileSystem,
            branch: None,
            enabled: true,
            access_token: None,
            gitlab_namespace: None,
            is_group: false,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            last_crawled: None,
            auto_crawl_enabled: false,
            cron_schedule: None,
            next_crawl_at: None,
            crawl_frequency_hours: None,
            max_crawl_duration_minutes: None,
        };
        
        // Test the crawler
        let result = crawler_service.crawl_repository(&repository).await;
        
        // Assert success
        assert!(result.is_ok(), "Crawler should succeed: {:?}", result.err());
        
        println!("✅ Filesystem repository crawling test passed!");
        
        // Clean up test index
        let _ = std::fs::remove_dir_all("./test_index");
    }

    #[tokio::test]
    async fn test_no_duplicates_on_recrawl() {
        // Skip test if DATABASE_URL is not set
        if std::env::var("DATABASE_URL").is_err() {
            println!("Skipping test: DATABASE_URL not set");
            return;
        }
        
        // Create a temporary directory with test files
        let temp_dir = TempDir::new().unwrap();
        let test_repo_path = temp_dir.path();
        
        // Create test files
        fs::write(
            test_repo_path.join("unique_test.rs"), 
            "fn unique_test_function() {\n    println!(\"Hello from unique test!\");\n}"
        ).unwrap();
        
        fs::write(
            test_repo_path.join("config.yaml"), 
            "name: duplicate-test\nversion: 2.0.0"
        ).unwrap();
        
        // Initialize services
        let database = PgPool::connect(&std::env::var("DATABASE_URL").unwrap()).await.unwrap();
        
        let search_service = Arc::new(SearchService::new("./duplicate_test_index").unwrap());
        let progress_tracker = Arc::new(ProgressTracker::new());
        let crawler_service = CrawlerService::new(database, search_service.clone(), progress_tracker).unwrap();
        
        // Create a test repository
        let repository = Repository {
            id: Uuid::new_v4(),
            name: "duplicate-test-repo".to_string(),
            url: test_repo_path.to_string_lossy().to_string(),
            repository_type: RepositoryType::FileSystem,
            branch: None,
            enabled: true,
            access_token: None,
            gitlab_namespace: None,
            is_group: false,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            last_crawled: None,
            auto_crawl_enabled: false,
            cron_schedule: None,
            next_crawl_at: None,
            crawl_frequency_hours: None,
            max_crawl_duration_minutes: None,
        };
        
        // First crawl
        println!("🔍 Starting first crawl...");
        let result1 = crawler_service.crawl_repository(&repository).await;
        assert!(result1.is_ok(), "First crawl should succeed: {:?}", result1.err());
        
        // Get document count after first crawl
        let count_after_first = search_service.get_document_count().unwrap();
        println!("📊 Documents after first crawl: {}", count_after_first);
        
        // Second crawl (should update existing documents, not create duplicates)
        println!("🔍 Starting second crawl...");
        let result2 = crawler_service.crawl_repository(&repository).await;
        assert!(result2.is_ok(), "Second crawl should succeed: {:?}", result2.err());
        
        // Get document count after second crawl
        let count_after_second = search_service.get_document_count().unwrap();
        println!("📊 Documents after second crawl: {}", count_after_second);
        
        // Assert that document count didn't increase (no duplicates created)
        assert_eq!(
            count_after_first, 
            count_after_second,
            "Document count should not increase on re-crawl (duplicates found!)"
        );
        
        // Test that we can still find the files after re-crawl
        let search_query = crate::services::search::SearchQuery {
            query: "unique_test_function".to_string(),
            project_filter: Some("duplicate-test-repo".to_string()),
            version_filter: None,
            extension_filter: None,
            limit: 10,
            offset: 0,
        };
        
        let search_results = search_service.search(search_query).await.unwrap();
        assert_eq!(search_results.results.len(), 1, "Should find exactly one result for unique function");
        assert_eq!(search_results.total, 1, "Total should be 1 (no duplicates)");
        
        println!("✅ No duplicates test passed!");
        println!("   - First crawl: {} documents", count_after_first);
        println!("   - Second crawl: {} documents", count_after_second);
        println!("   - Search results: {} (expected 1)", search_results.results.len());
        
        // Clean up test index
        let _ = std::fs::remove_dir_all("./duplicate_test_index");
    }

    #[test]
    fn test_deterministic_id_generation() {
        use std::hash::Hash;
        use std::collections::hash_map::DefaultHasher;
        use std::hash::Hasher;
        
        // Create a test repository - FileSystem type
        let filesystem_repo = Repository {
            id: Uuid::new_v4(),
            name: "test-filesystem-repo".to_string(),
            url: "/path/to/repo".to_string(),
            repository_type: RepositoryType::FileSystem,
            branch: None,
            enabled: true,
            access_token: None,
            gitlab_namespace: None,
            is_group: false,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            last_crawled: None,
            auto_crawl_enabled: false,
            cron_schedule: None,
            next_crawl_at: None,
            crawl_frequency_hours: None,
            max_crawl_duration_minutes: None,
        };

        // Create a test repository - Git type
        let git_repo = Repository {
            id: Uuid::new_v4(),
            name: "test-git-repo".to_string(),
            url: "https://github.com/user/repo.git".to_string(),
            repository_type: RepositoryType::Git,
            branch: Some("main".to_string()),
            enabled: true,
            access_token: None,
            gitlab_namespace: None,
            is_group: false,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            last_crawled: None,
            auto_crawl_enabled: false,
            cron_schedule: None,
            next_crawl_at: None,
            crawl_frequency_hours: None,
            max_crawl_duration_minutes: None,
        };

        // Test ID generation algorithm directly without needing CrawlerService instance
        let generate_test_id = |repo: &Repository, path: &str| -> Uuid {
            let mut hasher = Sha256::new();
            let input = match repo.repository_type {
                RepositoryType::FileSystem => {
                    format!("{}:{}", repo.url, path)
                },
                RepositoryType::Git | RepositoryType::GitLab => {
                    let branch = repo.branch.as_deref().unwrap_or("main");
                    format!("{}:{}:{}", repo.url, branch, path)
                }
            };
            hasher.update(input.as_bytes());
            let hash_bytes = hasher.finalize();
            let mut uuid_bytes = [0u8; 16];
            uuid_bytes.copy_from_slice(&hash_bytes[..16]);
            uuid_bytes[6] = (uuid_bytes[6] & 0x0f) | 0x40;
            uuid_bytes[8] = (uuid_bytes[8] & 0x3f) | 0x80;
            Uuid::from_bytes(uuid_bytes)
        };

        // Test the same file path generates the same ID consistently
        let file_path = "src/main.rs";
        
        let id1 = generate_test_id(&filesystem_repo, file_path);
        let id2 = generate_test_id(&filesystem_repo, file_path);
        
        // Should be identical
        assert_eq!(id1, id2, "Same repository and path should generate identical IDs");

        // Test different paths generate different IDs
        let id3 = generate_test_id(&filesystem_repo, "src/lib.rs");
        assert_ne!(id1, id3, "Different paths should generate different IDs");

        // Test different repositories generate different IDs for same path
        let id4 = generate_test_id(&git_repo, file_path);
        assert_ne!(id1, id4, "Different repositories should generate different IDs");

        // Test that Git repos with branches include branch in ID generation
        let git_repo_dev = Repository {
            branch: Some("dev".to_string()),
            ..git_repo.clone()
        };
        let id5 = generate_test_id(&git_repo_dev, file_path);
        assert_ne!(id4, id5, "Different branches should generate different IDs");

        println!("✅ Deterministic ID generation test passed!");
        println!("   - Filesystem repo ID: {}", id1);
        println!("   - Git repo (main) ID: {}", id4);
        println!("   - Git repo (dev) ID: {}", id5);
        
        // Test that IDs are valid UUIDs
        assert_eq!(id1.get_version(), Some(uuid::Version::Random));
        assert_eq!(id4.get_version(), Some(uuid::Version::Random));
        assert_eq!(id5.get_version(), Some(uuid::Version::Random));
    }

    #[tokio::test]
    async fn test_search_service_upsert_deduplication() {
        // This test verifies that the search service upsert method works correctly
        let test_index_name = format!("./test_upsert_index_{}", Uuid::new_v4());
        let search_service = SearchService::new(&test_index_name).unwrap();
        
        let file_id = Uuid::parse_str("12345678-1234-4321-8765-123456789abc").unwrap();
        let file_name = "test.rs";
        let file_path = "src/test.rs";
        let project = "test-project";
        let version = "HEAD";
        let extension = "rs";
        
        // First insert
        let content1 = "fn hello() { println!(\"Hello, World!\"); }";
        search_service.upsert_file(
            file_id,
            file_name,
            file_path,
            content1,
            project,
            version,
            extension,
        ).await.unwrap();
        
        search_service.commit().await.unwrap();
        
        // Check document count after first insert
        let count_after_first = search_service.get_document_count().unwrap();
        assert_eq!(count_after_first, 1, "Should have exactly 1 document after first insert");
        
        // Second insert with same ID but different content (update)
        let content2 = "fn hello() { println!(\"Hello, Rust!\"); }";
        search_service.upsert_file(
            file_id,
            file_name,
            file_path,
            content2,
            project,
            version,
            extension,
        ).await.unwrap();
        
        search_service.commit().await.unwrap();
        
        // Check document count after upsert - should still be 1
        let count_after_second = search_service.get_document_count().unwrap();
        assert_eq!(count_after_second, 1, "Should still have exactly 1 document after upsert (no duplicates)");
        
        // Verify the content was updated
        let found_doc = search_service.get_file_by_id(file_id).await.unwrap();
        assert!(found_doc.is_some(), "Should find the document by ID");
        
        let doc = found_doc.unwrap();
        assert!(doc.content_snippet.contains("Hello, Rust!"), "Content should be updated to new version");
        assert!(!doc.content_snippet.contains("Hello, World!"), "Old content should be replaced");
        
        println!("✅ Search service upsert deduplication test passed!");
        println!("   - Document count remained at 1 after upsert");
        println!("   - Content was successfully updated");
        
        // Clean up test index
        let _ = std::fs::remove_dir_all(&test_index_name);
    }
}
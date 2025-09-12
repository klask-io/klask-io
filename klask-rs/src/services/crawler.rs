use anyhow::{anyhow, Result};
use crate::models::{Repository, RepositoryType};
use crate::services::search::SearchService;
use git2::Repository as GitRepository;
use sqlx::{Pool, Postgres};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tracing::{debug, error, info, warn};
use uuid::Uuid;
use walkdir::WalkDir;

pub struct CrawlerService {
    database: Pool<Postgres>,
    search_service: Arc<SearchService>,
    pub temp_dir: PathBuf,
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
    pub fn new(database: Pool<Postgres>, search_service: Arc<SearchService>) -> Result<Self> {
        let temp_dir = std::env::temp_dir().join("klask-crawler");
        std::fs::create_dir_all(&temp_dir)
            .map_err(|e| anyhow!("Failed to create temp directory: {}", e))?;
        
        Ok(Self {
            database,
            search_service,
            temp_dir,
        })
    }

    pub async fn crawl_repository(&self, repository: &Repository) -> Result<()> {
        info!("Starting crawl for repository: {} ({}) - Type: {:?}", 
              repository.name, repository.url, repository.repository_type);
        
        let repo_path = match repository.repository_type {
            RepositoryType::FileSystem => {
                // For filesystem repositories, use the URL as the direct path
                PathBuf::from(&repository.url)
            },
            RepositoryType::Git | RepositoryType::GitLab => {
                // For Git repositories, use temp directory with cloning
                let temp_path = self.temp_dir.join(format!("{}-{}", repository.name, repository.id));
                let _git_repo = self.clone_or_update_repository(repository, &temp_path).await?;
                temp_path
            }
        };
        
        // Validate that the path exists
        if !repo_path.exists() {
            return Err(anyhow!("Repository path does not exist: {:?}", repo_path));
        }
        
        if !repo_path.is_dir() {
            return Err(anyhow!("Repository path is not a directory: {:?}", repo_path));
        }
        
        // Process all files in the repository
        let mut progress = CrawlProgress {
            files_processed: 0,
            files_indexed: 0,
            errors: Vec::new(),
        };
        
        self.process_repository_files(repository, &repo_path, &mut progress).await?;
        
        // Commit the Tantivy index to make changes searchable
        self.search_service.commit().await?;
        
        // Update repository last_crawled timestamp
        self.update_repository_crawl_time(repository.id).await?;
        
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
    ) -> Result<()> {
        // For Tantivy-only indexing, we don't need to track file deletions
        // since Tantivy will be rebuilt fresh for each crawl
        
        // Walk through all files in the repository
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
                    debug!("Skipping large file: {} ({} bytes)", relative_path_str, metadata.len());
                    continue;
                }
            }
            
            progress.files_processed += 1;
            
            match self.process_single_file(repository, file_path, &relative_path_str).await {
                Ok(()) => {
                    progress.files_indexed += 1;
                }
                Err(e) => {
                    let error_msg = format!("Failed to process file {}: {}", relative_path_str, e);
                    progress.errors.push(error_msg);
                    error!("Error processing file {}: {}", relative_path_str, e);
                }
            }
        }
        
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
            // Generate a unique ID for Tantivy indexing
            let file_id = Uuid::new_v4();
            let version = "HEAD".to_string();
            
            debug!("index file {}", relative_path);

            self.search_service.index_file(
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
        let crawler_service = CrawlerService::new(database, search_service).unwrap();
        
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
        };
        
        // Test the crawler
        let result = crawler_service.crawl_repository(&repository).await;
        
        // Assert success
        assert!(result.is_ok(), "Crawler should succeed: {:?}", result.err());
        
        println!("✅ Filesystem repository crawling test passed!");
        
        // Clean up test index
        let _ = std::fs::remove_dir_all("./test_index");
    }
}
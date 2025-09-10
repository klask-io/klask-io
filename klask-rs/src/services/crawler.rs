use anyhow::{anyhow, Result};
use crate::models::{Repository, File};
use crate::services::search::SearchService;
use git2::Repository as GitRepository;
use sqlx::{Pool, Postgres};
use std::collections::HashSet;
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
        info!("Starting crawl for repository: {} ({})", repository.name, repository.url);
        
        let repo_path = self.temp_dir.join(format!("{}-{}", repository.name, repository.id));
        
        // Clone or update repository
        let git_repo = self.clone_or_update_repository(repository, &repo_path).await?;
        
        // Get the current commit hash
        let _head_commit = git_repo.head()?.target().unwrap();
        
        // Process all files in the repository
        let mut progress = CrawlProgress {
            files_processed: 0,
            files_indexed: 0,
            errors: Vec::new(),
        };
        
        self.process_repository_files(repository, &repo_path, &mut progress).await?;
        
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
        // Get existing files from database to track deletions
        let existing_files = self.get_existing_files(repository.id).await?
            .into_iter()
            .map(|f| f.path)
            .collect::<HashSet<String>>();
        
        let mut current_files = HashSet::new();
        
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
            current_files.insert(relative_path_str.clone());
            
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
        
        // Remove files that no longer exist in the repository
        let deleted_files: Vec<String> = existing_files.difference(&current_files).cloned().collect();
        for deleted_file in deleted_files {
            if let Err(e) = self.remove_file_from_index(repository.id, &deleted_file).await {
                error!("Failed to remove deleted file from index: {}: {}", deleted_file, e);
            }
        }
        
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
        
        let metadata = file_path.metadata()
            .map_err(|e| anyhow!("Failed to get file metadata: {}", e))?;
        
        let extension = file_path.extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_string();
        
        let file_name = file_path.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("")
            .to_string();
        
        // Create or update file record
        let file_record = File {
            id: Uuid::new_v4(),
            name: file_name,
            path: relative_path.to_string(),
            content: content.clone(),
            project: repository.name.clone(),
            version: "HEAD".to_string(), // Could be enhanced to use actual commit hash
            extension,
            size: metadata.len() as i64,
            last_modified: chrono::DateTime::from(
                metadata.modified().unwrap_or(std::time::SystemTime::now())
            ),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        
        // Save to database
        self.save_file_to_database(repository.id, &file_record).await?;
        
        // Index in search engine if content is available
        if let Some(content) = content {
            self.search_service.index_file(
                file_record.id,
                &file_record.name,
                &file_record.path,
                &content,
                &file_record.project,
                &file_record.version,
                &file_record.extension,
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
    
    pub async fn get_existing_files(&self, repository_id: Uuid) -> Result<Vec<File>> {
        let files = sqlx::query_as::<_, File>(
            "SELECT * FROM files WHERE project = (SELECT name FROM repositories WHERE id = $1)"
        )
        .bind(repository_id)
        .fetch_all(&self.database)
        .await
        .map_err(|e| anyhow!("Failed to fetch existing files: {}", e))?;
        
        Ok(files)
    }
    
    pub async fn save_file_to_database(&self, _repository_id: Uuid, file: &File) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO files (id, name, path, content, project, version, extension, size, last_modified, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (path, project) DO UPDATE SET
                name = EXCLUDED.name,
                content = EXCLUDED.content,
                version = EXCLUDED.version,
                extension = EXCLUDED.extension,
                size = EXCLUDED.size,
                last_modified = EXCLUDED.last_modified,
                updated_at = EXCLUDED.updated_at
            "#
        )
        .bind(&file.id)
        .bind(&file.name)
        .bind(&file.path)
        .bind(&file.content)
        .bind(&file.project)
        .bind(&file.version)
        .bind(&file.extension)
        .bind(file.size)
        .bind(file.last_modified)
        .bind(file.created_at)
        .bind(file.updated_at)
        .execute(&self.database)
        .await
        .map_err(|e| anyhow!("Failed to save file to database: {}", e))?;
        
        Ok(())
    }
    
    async fn remove_file_from_index(&self, repository_id: Uuid, file_path: &str) -> Result<()> {
        // Remove from database
        let repository_name = sqlx::query_scalar::<_, String>(
            "SELECT name FROM repositories WHERE id = $1"
        )
        .bind(repository_id)
        .fetch_one(&self.database)
        .await
        .map_err(|e| anyhow!("Failed to get repository name: {}", e))?;
        
        sqlx::query(
            "DELETE FROM files WHERE path = $1 AND project = $2"
        )
        .bind(file_path)
        .bind(&repository_name)
        .execute(&self.database)
        .await
        .map_err(|e| anyhow!("Failed to delete file from database: {}", e))?;
        
        // Remove from search index
        // Note: Tantivy doesn't have a direct delete by field, so we would need to
        // rebuild the index or implement a deletion strategy
        debug!("File removed from database: {}", file_path);
        
        Ok(())
    }
    
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
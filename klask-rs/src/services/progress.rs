use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CrawlStatus {
    Starting,
    Cloning,
    Processing,
    Indexing,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlProgressInfo {
    pub repository_id: Uuid,
    pub repository_name: String,
    pub status: CrawlStatus,
    pub progress_percentage: f32,
    pub files_processed: usize,
    pub files_total: Option<usize>,
    pub files_indexed: usize,
    pub current_file: Option<String>,
    pub error_message: Option<String>,
    pub started_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

impl CrawlProgressInfo {
    pub fn new(repository_id: Uuid, repository_name: String) -> Self {
        let now = Utc::now();
        Self {
            repository_id,
            repository_name,
            status: CrawlStatus::Starting,
            progress_percentage: 0.0,
            files_processed: 0,
            files_total: None,
            files_indexed: 0,
            current_file: None,
            error_message: None,
            started_at: now,
            updated_at: now,
            completed_at: None,
        }
    }

    pub fn update_status(&mut self, status: CrawlStatus) {
        match &status {
            CrawlStatus::Completed | CrawlStatus::Failed | CrawlStatus::Cancelled => {
                self.completed_at = Some(Utc::now());
                self.progress_percentage = 100.0;
            }
            _ => {}
        }
        
        self.status = status;
        self.updated_at = Utc::now();
    }

    pub fn update_progress(&mut self, files_processed: usize, files_total: Option<usize>, files_indexed: usize) {
        self.files_processed = files_processed;
        self.files_total = files_total;
        self.files_indexed = files_indexed;
        self.updated_at = Utc::now();
        
        if let Some(total) = files_total {
            if total > 0 {
                self.progress_percentage = (files_processed as f32 / total as f32 * 100.0).min(100.0);
            }
        }
    }

    pub fn set_current_file(&mut self, file_path: Option<String>) {
        self.current_file = file_path;
        self.updated_at = Utc::now();
    }

    pub fn set_error(&mut self, error_message: String) {
        self.error_message = Some(error_message);
        self.status = CrawlStatus::Failed;
        self.completed_at = Some(Utc::now());
        self.updated_at = Utc::now();
    }
}

pub struct ProgressTracker {
    progress_map: Arc<RwLock<HashMap<Uuid, CrawlProgressInfo>>>,
}

impl ProgressTracker {
    pub fn new() -> Self {
        Self {
            progress_map: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn start_crawl(&self, repository_id: Uuid, repository_name: String) -> CrawlProgressInfo {
        let progress = CrawlProgressInfo::new(repository_id, repository_name);
        let mut map = self.progress_map.write().await;
        map.insert(repository_id, progress.clone());
        progress
    }

    pub async fn update_status(&self, repository_id: Uuid, status: CrawlStatus) {
        let mut map = self.progress_map.write().await;
        if let Some(progress) = map.get_mut(&repository_id) {
            progress.update_status(status);
        }
    }

    pub async fn update_progress(
        &self, 
        repository_id: Uuid, 
        files_processed: usize, 
        files_total: Option<usize>, 
        files_indexed: usize
    ) {
        let mut map = self.progress_map.write().await;
        if let Some(progress) = map.get_mut(&repository_id) {
            progress.update_progress(files_processed, files_total, files_indexed);
        }
    }

    pub async fn set_current_file(&self, repository_id: Uuid, file_path: Option<String>) {
        let mut map = self.progress_map.write().await;
        if let Some(progress) = map.get_mut(&repository_id) {
            progress.set_current_file(file_path);
        }
    }

    pub async fn set_error(&self, repository_id: Uuid, error_message: String) {
        let mut map = self.progress_map.write().await;
        if let Some(progress) = map.get_mut(&repository_id) {
            progress.set_error(error_message);
        }
    }

    pub async fn complete_crawl(&self, repository_id: Uuid) {
        let mut map = self.progress_map.write().await;
        if let Some(progress) = map.get_mut(&repository_id) {
            progress.update_status(CrawlStatus::Completed);
        }
    }

    pub async fn get_progress(&self, repository_id: Uuid) -> Option<CrawlProgressInfo> {
        let map = self.progress_map.read().await;
        map.get(&repository_id).cloned()
    }

    pub async fn get_all_active_progress(&self) -> Vec<CrawlProgressInfo> {
        let map = self.progress_map.read().await;
        map.values()
            .filter(|p| !matches!(p.status, CrawlStatus::Completed | CrawlStatus::Failed | CrawlStatus::Cancelled))
            .cloned()
            .collect()
    }

    pub async fn cleanup_old_progress(&self, hours: i64) {
        let cutoff = Utc::now() - chrono::Duration::hours(hours);
        let mut map = self.progress_map.write().await;
        map.retain(|_, progress| {
            // Keep active crawls and recent completed ones
            match progress.status {
                CrawlStatus::Completed | CrawlStatus::Failed | CrawlStatus::Cancelled => {
                    progress.completed_at.map_or(true, |completed| completed > cutoff)
                }
                _ => true, // Keep all active crawls
            }
        });
    }

    // Cancel a crawl
    pub async fn cancel_crawl(&self, repository_id: Uuid) {
        let mut map = self.progress_map.write().await;
        if let Some(progress) = map.get_mut(&repository_id) {
            progress.update_status(CrawlStatus::Cancelled);
        }
    }

    // Remove completed crawl from tracking
    pub async fn remove_progress(&self, repository_id: Uuid) {
        let mut map = self.progress_map.write().await;
        map.remove(&repository_id);
    }

    // Check if a repository is currently being crawled
    pub async fn is_crawling(&self, repository_id: Uuid) -> bool {
        let map = self.progress_map.read().await;
        map.get(&repository_id)
            .map(|progress| !matches!(progress.status, CrawlStatus::Completed | CrawlStatus::Failed | CrawlStatus::Cancelled))
            .unwrap_or(false)
    }
}
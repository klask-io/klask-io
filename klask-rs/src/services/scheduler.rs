use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use std::{collections::HashMap, sync::Arc, time::Duration};
use tokio_cron_scheduler::{Job, JobScheduler};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::{
    models::repository::Repository, repositories::repository_repository::RepositoryRepository,
    services::crawler::CrawlerService,
};

pub struct SchedulerService {
    scheduler: JobScheduler,
    pool: PgPool,
    crawler_service: Arc<CrawlerService>,
    job_ids: Arc<tokio::sync::RwLock<HashMap<Uuid, Uuid>>>, // repository_id -> job_id
}

impl SchedulerService {
    pub async fn new(pool: PgPool, crawler_service: Arc<CrawlerService>) -> Result<Self> {
        let scheduler = JobScheduler::new().await?;

        Ok(Self {
            scheduler,
            pool,
            crawler_service,
            job_ids: Arc::new(tokio::sync::RwLock::new(HashMap::new())),
        })
    }

    /// Start the scheduler and load all scheduled repositories
    pub async fn start(&self) -> Result<()> {
        info!("Starting repository scheduler service");

        // Start the scheduler
        self.scheduler.start().await?;

        // Spawn a background task to keep the scheduler running
        let mut scheduler_clone = self.scheduler.clone();
        tokio::spawn(async move {
            loop {
                // This is required to keep the scheduler running
                // The scheduler needs to check for jobs periodically
                if let Ok(duration) = scheduler_clone.time_till_next_job().await {
                    if let Some(duration) = duration {
                        debug!("Next job in {:?}", duration);
                        tokio::time::sleep(duration).await;
                    } else {
                        // No jobs scheduled, wait a bit
                        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
                    }
                } else {
                    // Error getting next job time, wait a bit
                    tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
                }
            }
        });

        // Load all repositories with scheduling enabled
        self.reload_scheduled_repositories().await?;

        // Schedule a periodic task to reload repository schedules (every 5 minutes)
        self.schedule_periodic_reload().await?;

        info!("Repository scheduler service started successfully");
        Ok(())
    }

    /// Stop the scheduler service
    #[allow(dead_code)]
    pub async fn stop(&mut self) -> Result<()> {
        info!("Stopping repository scheduler service");
        self.scheduler.shutdown().await?;
        info!("Repository scheduler service stopped");
        Ok(())
    }

    /// Schedule a repository for automatic crawling
    pub async fn schedule_repository(&self, repository: &Repository) -> Result<()> {
        if !repository.auto_crawl_enabled {
            debug!("Auto-crawl not enabled for repository {}", repository.id);
            return Ok(());
        }

        // Remove existing schedule if any
        self.unschedule_repository(repository.id).await?;

        let schedule_expr = if let Some(ref cron_schedule) = repository.cron_schedule {
            // Convert 5-field cron to 6-field if needed (tokio-cron-scheduler uses 6 fields with seconds)
            let parts: Vec<&str> = cron_schedule.split_whitespace().collect();
            if parts.len() == 5 {
                // Add "0" at the beginning for seconds
                format!("0 {}", cron_schedule)
            } else {
                cron_schedule.clone()
            }
        } else if let Some(frequency_hours) = repository.crawl_frequency_hours {
            // Convert hours to cron expression (run every X hours)
            // tokio-cron-scheduler uses seconds-based cron (6 fields)
            // Format: sec min hour day month weekday
            if frequency_hours == 1 {
                // Every hour at minute 0
                "0 0 * * * *".to_string()
            } else if frequency_hours < 24 {
                // Every N hours at minute 0
                format!("0 0 */{} * * *", frequency_hours)
            } else {
                // Daily at midnight
                "0 0 0 * * *".to_string()
            }
        } else {
            // Default to every minute for testing (change back to daily in production)
            warn!("Repository {} has auto-crawl enabled but no schedule defined, defaulting to every minute for testing", repository.id);
            "0 * * * * *".to_string() // Every minute for testing
        };

        // Skip validation here as tokio-cron-scheduler will validate itself
        // The cron crate uses 5-field format while tokio-cron-scheduler uses 6-field
        debug!("Will schedule with expression: {}", schedule_expr);

        let repository_id = repository.id;
        let max_duration = repository.max_crawl_duration_minutes.unwrap_or(60) as u64;
        let repository_name = repository.name.clone();

        let pool = self.pool.clone();
        let crawler_service = self.crawler_service.clone();

        // Log the schedule being created
        info!(
            "Creating schedule for repository {} ({}) with expression: {}",
            repository_name, repository_id, schedule_expr
        );

        // Create the job
        let job = Job::new_cron_job_async(schedule_expr.as_str(), move |job_uuid, _job_lock| {
            let pool = pool.clone();
            let crawler_service = crawler_service.clone();
            let repository_name = repository_name.clone();

            info!(
                "📅 Job created with UUID: {:?} for repository: {} ({})",
                job_uuid, repository_name, repository_id
            );

            Box::pin(async move {
                info!(
                    "🚀 SCHEDULED CRAWL TRIGGERED for repository: {} ({})",
                    repository_name, repository_id
                );

                // Check if repository is already being crawled
                if crawler_service.is_crawling(repository_id).await {
                    info!(
                        "⏭️  Skipping scheduled crawl for repository {} ({}) - already in progress",
                        repository_name, repository_id
                    );
                    return;
                }

                // Set up timeout for the crawl operation
                let crawl_timeout = Duration::from_secs(max_duration * 60);

                let crawl_result = tokio::time::timeout(crawl_timeout, async {
                    // Update next_crawl_at timestamp
                    if let Err(e) = update_next_crawl_time(&pool, repository_id).await {
                        error!(
                            "Failed to update next_crawl_at for repository {}: {}",
                            repository_id, e
                        );
                    }

                    // Fetch repository details
                    let repository_repo = RepositoryRepository::new(pool);
                    let repository_result = repository_repo.get_repository(repository_id).await;

                    let result = match repository_result {
                        Ok(Some(repo)) => {
                            // Perform the crawl
                            crawler_service.crawl_repository(&repo).await
                        }
                        Ok(None) => {
                            error!("Repository {} not found", repository_id);
                            Err(anyhow::anyhow!("Repository not found"))
                        }
                        Err(e) => {
                            error!("Failed to fetch repository {}: {}", repository_id, e);
                            Err(e)
                        }
                    };

                    // Log results
                    match &result {
                        Ok(_) => {
                            info!(
                                "Scheduled crawl completed successfully for repository: {} ({})",
                                repository_name, repository_id
                            );
                        }
                        Err(e) => {
                            error!(
                                "Scheduled crawl failed for repository {} ({}): {}",
                                repository_name, repository_id, e
                            );
                        }
                    }

                    result
                })
                .await;

                match crawl_result {
                    Ok(Ok(_)) => {
                        info!(
                            "Scheduled crawl for repository {} completed within timeout",
                            repository_id
                        );
                    }
                    Ok(Err(e)) => {
                        error!(
                            "Scheduled crawl for repository {} failed: {}",
                            repository_id, e
                        );
                    }
                    Err(_) => {
                        error!(
                            "Scheduled crawl for repository {} timed out after {} minutes",
                            repository_id, max_duration
                        );
                    }
                }
            })
        })?;

        // Add the job to scheduler
        let job_id = self.scheduler.add(job).await?;

        // Store job ID for later removal
        {
            let mut job_ids = self.job_ids.write().await;
            job_ids.insert(repository_id, job_id);
        }

        info!(
            "Scheduled repository {} ({}) with cron expression: {}",
            repository.name, repository_id, schedule_expr
        );
        Ok(())
    }

    /// Remove scheduling for a repository
    pub async fn unschedule_repository(&self, repository_id: Uuid) -> Result<()> {
        let mut job_ids = self.job_ids.write().await;

        if let Some(job_id) = job_ids.remove(&repository_id) {
            if let Err(e) = self.scheduler.remove(&job_id).await {
                error!(
                    "Failed to remove scheduled job for repository {}: {}",
                    repository_id, e
                );
                return Err(e.into());
            }
            info!("Unscheduled repository {}", repository_id);
        }

        Ok(())
    }

    /// Update schedule for a repository
    pub async fn update_repository_schedule(&self, repository: &Repository) -> Result<()> {
        if repository.auto_crawl_enabled {
            self.schedule_repository(repository).await?;
        } else {
            self.unschedule_repository(repository.id).await?;
        }
        Ok(())
    }

    /// Get next scheduled run time for a repository
    #[allow(dead_code)]
    pub async fn get_next_run_time(&self, _repository_id: Uuid) -> Option<DateTime<Utc>> {
        // TODO: Implement proper next run time retrieval with tokio_cron_scheduler
        None
    }

    /// Reload all scheduled repositories from database
    pub async fn reload_scheduled_repositories(&self) -> Result<()> {
        info!("Reloading scheduled repositories from database");

        let repository_repo = RepositoryRepository::new(self.pool.clone());
        let repositories = repository_repo.find_all().await?;

        let mut scheduled_count = 0;
        let mut error_count = 0;

        for repository in repositories {
            if repository.auto_crawl_enabled {
                match self.schedule_repository(&repository).await {
                    Ok(_) => {
                        scheduled_count += 1;

                        // Update next_crawl_at in database if not set
                        if repository.next_crawl_at.is_none() {
                            if let Err(e) = update_next_crawl_time(&self.pool, repository.id).await
                            {
                                warn!(
                                    "Failed to update next_crawl_at for repository {}: {}",
                                    repository.id, e
                                );
                            }
                        }
                    }
                    Err(e) => {
                        error!(
                            "Failed to schedule repository {} ({}): {}",
                            repository.name, repository.id, e
                        );
                        error_count += 1;
                    }
                }
            }
        }

        info!(
            "Reloaded {} scheduled repositories ({} errors)",
            scheduled_count, error_count
        );
        Ok(())
    }

    /// Get scheduler status and statistics
    pub async fn get_status(&self) -> Result<SchedulerStatus> {
        let job_ids = self.job_ids.read().await;
        let scheduled_count = job_ids.len();

        let repository_repo = RepositoryRepository::new(self.pool.clone());
        let all_repositories = repository_repo.find_all().await?;
        let auto_crawl_enabled_count = all_repositories
            .iter()
            .filter(|r| r.auto_crawl_enabled)
            .count();

        // TODO: Get next runs for all scheduled repositories
        let mut next_runs = Vec::new();

        // Sort by next run time
        next_runs.sort_by(|a: &NextScheduledRun, b| a.next_run_at.cmp(&b.next_run_at));

        Ok(SchedulerStatus {
            is_running: true,
            scheduled_repositories_count: scheduled_count,
            auto_crawl_enabled_count,
            next_runs,
        })
    }

    /// Schedule a periodic task to reload repository schedules
    async fn schedule_periodic_reload(&self) -> Result<()> {
        let pool = self.pool.clone();
        let _scheduler_service = Arc::new(self);

        let job = Job::new_cron_job_async("0 */5 * * * *", move |_uuid, _l| {
            // Every 5 minutes
            let pool = pool.clone();

            Box::pin(async move {
                debug!("Running periodic repository schedule reload");

                // Create a new scheduler service instance for the reload
                // This is a simplified approach - in production you might want to use a different pattern
                let repository_repo = RepositoryRepository::new(pool);
                if let Ok(repositories) = repository_repo.find_all().await {
                    let mut changes_detected = 0;

                    // Check for repositories that need schedule updates
                    // This is a basic implementation - you could make it more sophisticated
                    for repository in repositories {
                        if repository.auto_crawl_enabled {
                            // In a full implementation, you'd track which repositories have changed
                            // and only update those. For now, we'll just log.
                            changes_detected += 1;
                        }
                    }

                    if changes_detected > 0 {
                        debug!(
                            "Detected {} repositories with auto-crawl enabled",
                            changes_detected
                        );
                    }
                }
            })
        })?;

        self.scheduler.add(job).await?;
        debug!("Scheduled periodic repository reload task");
        Ok(())
    }
}

/// Update the next_crawl_at timestamp for a repository based on its schedule
async fn update_next_crawl_time(pool: &PgPool, repository_id: Uuid) -> Result<()> {
    // Get repository to check its schedule
    let repository_repo = RepositoryRepository::new(pool.clone());
    let repository = repository_repo
        .find_by_id(repository_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Repository not found"))?;

    let next_crawl_at = if let Some(ref cron_schedule) = repository.cron_schedule {
        // Parse cron schedule and calculate next run using the cron library
        // The cron library expects 5-field expressions (no seconds)
        let parts: Vec<&str> = cron_schedule.split_whitespace().collect();
        let five_field_cron = if parts.len() == 6 {
            // Remove seconds field if present (skip first field)
            parts[1..].join(" ")
        } else {
            cron_schedule.clone()
        };

        // Use the cron library to parse and calculate next occurrence
        match five_field_cron.parse::<cron::Schedule>() {
            Ok(schedule) => {
                // Get the next occurrence after now
                schedule.upcoming(chrono::Utc).take(1).next()
            }
            Err(e) => {
                error!("Invalid cron expression '{}': {}", cron_schedule, e);
                None
            }
        }
    } else {
        repository
            .crawl_frequency_hours
            .map(|frequency_hours| Utc::now() + chrono::Duration::hours(frequency_hours as i64))
    };

    if let Some(next_time) = next_crawl_at {
        sqlx::query("UPDATE repositories SET next_crawl_at = $1 WHERE id = $2")
            .bind(next_time)
            .bind(repository_id)
            .execute(pool)
            .await?;

        debug!(
            "Updated next_crawl_at for repository {} to {}",
            repository_id, next_time
        );
    }

    Ok(())
}

#[derive(Debug)]
pub struct SchedulerStatus {
    pub is_running: bool,
    pub scheduled_repositories_count: usize,
    pub auto_crawl_enabled_count: usize,
    pub next_runs: Vec<NextScheduledRun>,
}

#[derive(Debug)]
pub struct NextScheduledRun {
    pub repository_id: Uuid,
    pub repository_name: String,
    pub next_run_at: Option<DateTime<Utc>>,
    pub schedule_expression: Option<String>,
}

impl Clone for SchedulerService {
    fn clone(&self) -> Self {
        Self {
            scheduler: self.scheduler.clone(),
            pool: self.pool.clone(),
            crawler_service: self.crawler_service.clone(),
            job_ids: self.job_ids.clone(),
        }
    }
}

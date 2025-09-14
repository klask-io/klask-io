use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;
use chrono::{Utc, Duration};
use tracing::{info, error, debug};

use crate::models::{User, UserRole, Repository, RepositoryType, File};
use crate::repositories::{UserRepository, RepositoryRepository, FileRepository};

pub struct SeedingService {
    pool: PgPool,
}

impl SeedingService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn seed_all(&self) -> Result<()> {
        info!("Starting database seeding...");
        
        self.seed_users().await?;
        let repository_ids = self.seed_repositories().await?;
        self.seed_files(&repository_ids).await?;
        
        info!("Database seeding completed successfully!");
        Ok(())
    }

    pub async fn clear_all(&self) -> Result<()> {
        info!("Clearing all seed data...");
        
        // Clear in reverse order due to foreign key constraints
        sqlx::query("DELETE FROM files").execute(&self.pool).await?;
        sqlx::query("DELETE FROM repositories").execute(&self.pool).await?;
        sqlx::query("DELETE FROM users").execute(&self.pool).await?;
        
        info!("All seed data cleared!");
        Ok(())
    }

    async fn seed_users(&self) -> Result<()> {
        info!("Seeding users...");
        let user_repo = UserRepository::new(self.pool.clone());
        
        let users = vec![
            User {
                id: Uuid::new_v4(),
                username: "admin".to_string(),
                email: "admin@klask.io".to_string(),
                password_hash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewreZYTc0KL7DYpO".to_string(), // password123
                role: UserRole::Admin,
                active: true,
                created_at: Utc::now() - Duration::days(30),
                updated_at: Utc::now() - Duration::days(1),
            },
            User {
                id: Uuid::new_v4(),
                username: "developer1".to_string(),
                email: "dev1@klask.io".to_string(),
                password_hash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewreZYTc0KL7DYpO".to_string(), // password123
                role: UserRole::User,
                active: true,
                created_at: Utc::now() - Duration::days(25),
                updated_at: Utc::now() - Duration::days(2),
            },
            User {
                id: Uuid::new_v4(),
                username: "developer2".to_string(),
                email: "dev2@klask.io".to_string(),
                password_hash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewreZYTc0KL7DYpO".to_string(), // password123
                role: UserRole::User,
                active: true,
                created_at: Utc::now() - Duration::days(20),
                updated_at: Utc::now() - Duration::days(1),
            },
            User {
                id: Uuid::new_v4(),
                username: "maintainer".to_string(),
                email: "maintainer@klask.io".to_string(),
                password_hash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LearreZYTc0KL7DYpO".to_string(), // password123
                role: UserRole::Admin,
                active: true,
                created_at: Utc::now() - Duration::days(15),
                updated_at: Utc::now() - Duration::hours(12),
            },
            User {
                id: Uuid::new_v4(),
                username: "tester".to_string(),
                email: "tester@klask.io".to_string(),
                password_hash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewreZYTc0KL7DYpO".to_string(), // password123
                role: UserRole::User,
                active: false,
                created_at: Utc::now() - Duration::days(10),
                updated_at: Utc::now() - Duration::days(5),
            },
        ];

        for user in users {
            match user_repo.create_user(&user).await {
                Ok(_) => {
                    debug!("Created user: {}", user.username);
                },
                Err(e) => {
                    if e.to_string().contains("duplicate key value") {
                        debug!("User {} already exists, skipping", user.username);
                    } else {
                        error!("Failed to create user {}: {:?}", user.username, e);
                        return Err(e);
                    }
                }
            }
        }

        info!("Users seeding completed");
        Ok(())
    }

    async fn seed_repositories(&self) -> Result<Vec<Uuid>> {
        info!("Seeding repositories...");
        let repo_repo = RepositoryRepository::new(self.pool.clone());
        
        let mut repository_ids = Vec::new();
        
        let repositories = vec![
            Repository {
                id: Uuid::new_v4(),
                name: "klask-react".to_string(),
                url: "https://github.com/klask-io/klask-react".to_string(),
                repository_type: RepositoryType::Git,
                branch: Some("main".to_string()),
                enabled: true,
                access_token: None,
                gitlab_namespace: None,
                is_group: false,
                last_crawled: Some(Utc::now() - Duration::hours(6)),
                created_at: Utc::now() - Duration::days(20),
                updated_at: Utc::now() - Duration::hours(6),
                auto_crawl_enabled: true,
                cron_schedule: Some("0 */6 * * *".to_string()),
                next_crawl_at: Some(Utc::now() + Duration::hours(2)),
                crawl_frequency_hours: Some(6),
                max_crawl_duration_minutes: Some(30),
            },
            Repository {
                id: Uuid::new_v4(),
                name: "klask-rs".to_string(),
                url: "https://github.com/klask-io/klask-rs".to_string(),
                repository_type: RepositoryType::Git,
                branch: Some("main".to_string()),
                enabled: true,
                access_token: None,
                gitlab_namespace: None,
                is_group: false,
                last_crawled: Some(Utc::now() - Duration::hours(2)),
                created_at: Utc::now() - Duration::days(18),
                updated_at: Utc::now() - Duration::hours(2),
                auto_crawl_enabled: true,
                cron_schedule: Some("0 */4 * * *".to_string()),
                next_crawl_at: Some(Utc::now() + Duration::hours(1)),
                crawl_frequency_hours: Some(4),
                max_crawl_duration_minutes: Some(20),
            },
            Repository {
                id: Uuid::new_v4(),
                name: "docs".to_string(),
                url: "/var/www/docs".to_string(),
                repository_type: RepositoryType::FileSystem,
                branch: None,
                enabled: true,
                access_token: None,
                gitlab_namespace: None,
                is_group: false,
                last_crawled: Some(Utc::now() - Duration::hours(12)),
                created_at: Utc::now() - Duration::days(15),
                updated_at: Utc::now() - Duration::hours(12),
                auto_crawl_enabled: false,
                cron_schedule: None,
                next_crawl_at: None,
                crawl_frequency_hours: None,
                max_crawl_duration_minutes: Some(10),
            },
            Repository {
                id: Uuid::new_v4(),
                name: "example-api".to_string(),
                url: "https://gitlab.example.com/api/example-api".to_string(),
                repository_type: RepositoryType::GitLab,
                branch: Some("develop".to_string()),
                enabled: true,
                access_token: None,
                gitlab_namespace: Some("api".to_string()),
                is_group: false,
                last_crawled: None, // Never crawled
                created_at: Utc::now() - Duration::days(5),
                updated_at: Utc::now() - Duration::days(5),
                auto_crawl_enabled: false,
                cron_schedule: None,
                next_crawl_at: None,
                crawl_frequency_hours: None,
                max_crawl_duration_minutes: Some(15),
            },
            Repository {
                id: Uuid::new_v4(),
                name: "legacy-system".to_string(),
                url: "https://github.com/company/legacy-system".to_string(),
                repository_type: RepositoryType::Git,
                branch: Some("master".to_string()),
                enabled: false, // Disabled repository
                access_token: None,
                gitlab_namespace: None,
                is_group: false,
                last_crawled: Some(Utc::now() - Duration::days(30)),
                created_at: Utc::now() - Duration::days(45),
                updated_at: Utc::now() - Duration::days(30),
                auto_crawl_enabled: false,
                cron_schedule: None,
                next_crawl_at: None,
                crawl_frequency_hours: None,
                max_crawl_duration_minutes: Some(60),
            },
        ];

        for repo in repositories {
            repository_ids.push(repo.id);
            match repo_repo.create_repository(&repo).await {
                Ok(_) => {
                    debug!("Created repository: {}", repo.name);
                },
                Err(e) => {
                    if e.to_string().contains("duplicate key value") {
                        debug!("Repository {} already exists, skipping", repo.name);
                    } else {
                        error!("Failed to create repository {}: {:?}", repo.name, e);
                        return Err(e);
                    }
                }
            }
        }

        info!("Repositories seeding completed");
        Ok(repository_ids)
    }

    async fn seed_files(&self, repository_ids: &[Uuid]) -> Result<()> {
        info!("Seeding files...");
        let file_repo = FileRepository::new(self.pool.clone());
        
        // Sample files for each repository
        let file_templates = vec![
            ("src/main.rs", "rust", "fn main() {\n    println!(\"Hello, world!\");\n}"),
            ("src/lib.rs", "rust", "pub mod api;\npub mod database;\npub mod models;"),
            ("package.json", "json", "{\n  \"name\": \"klask-react\",\n  \"version\": \"1.0.0\"\n}"),
            ("README.md", "md", "# Klask Search Engine\n\nA modern code search engine."),
            ("src/components/Search.tsx", "tsx", "import React from 'react';\n\nexport const Search = () => {\n  return <div>Search</div>;\n};"),
            ("config/database.yml", "yml", "development:\n  adapter: postgresql\n  database: klask_dev"),
            ("Dockerfile", "", "FROM rust:1.70\nWORKDIR /app\nCOPY . ."),
            (".gitignore", "", "target/\n*.log\nnode_modules/"),
            ("tests/integration_test.rs", "rust", "#[cfg(test)]\nmod tests {\n    #[test]\n    fn it_works() {\n        assert_eq!(2 + 2, 4);\n    }\n}"),
            ("docs/api.md", "md", "# API Documentation\n\n## Endpoints\n\n### GET /api/search"),
        ];

        for (i, &repo_id) in repository_ids.iter().enumerate() {
            let project_name = match i {
                0 => "klask-react",
                1 => "klask-rs", 
                2 => "docs",
                3 => "example-api",
                4 => "legacy-system",
                _ => "unknown",
            };

            // Create multiple files per repository
            for (j, (path, extension, content)) in file_templates.iter().enumerate() {
                let file = File {
                    id: Uuid::new_v4(),
                    name: path.split('/').last().unwrap_or(path).to_string(),
                    path: path.to_string(),
                    content: Some(content.to_string()),
                    project: project_name.to_string(),
                    version: "main".to_string(),
                    extension: extension.to_string(),
                    size: content.len() as i64,
                    last_modified: Utc::now() - Duration::hours((j as i64 % 24) + 1),
                    created_at: Utc::now() - Duration::days((j as i64 % 10) + 1),
                    updated_at: Utc::now() - Duration::hours((j as i64 % 12) + 1),
                };

                match file_repo.create_file(&file, repo_id).await {
                    Ok(_) => {
                        debug!("Created file: {} in project {}", file.path, project_name);
                    },
                    Err(e) => {
                        if e.to_string().contains("duplicate key value") {
                            debug!("File {} already exists in {}, skipping", file.path, project_name);
                        } else {
                            error!("Failed to create file {}: {:?}", file.path, e);
                            return Err(e);
                        }
                    }
                }
            }
        }

        info!("Files seeding completed");
        Ok(())
    }

    pub async fn get_stats(&self) -> Result<SeedingStats> {
        let user_count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users")
            .fetch_one(&self.pool).await?;
        
        let repo_count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM repositories")
            .fetch_one(&self.pool).await?;
        
        let file_count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM files")
            .fetch_one(&self.pool).await?;

        Ok(SeedingStats {
            users: user_count,
            repositories: repo_count,
            files: file_count,
        })
    }
}

#[derive(Debug, serde::Serialize)]
pub struct SeedingStats {
    pub users: i64,
    pub repositories: i64,
    pub files: i64,
}
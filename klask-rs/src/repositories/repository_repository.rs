use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;
use crate::models::Repository;

pub struct RepositoryRepository {
    pool: PgPool,
}

impl RepositoryRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create_repository(&self, repository: &Repository) -> Result<Repository> {
        let result = sqlx::query_as::<_, Repository>(
            "INSERT INTO repositories (id, name, url, repository_type, branch, enabled) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, url, repository_type, branch, enabled, last_crawled, created_at, updated_at"
        )
        .bind(repository.id)
        .bind(&repository.name)
        .bind(&repository.url)
        .bind(&repository.repository_type)
        .bind(&repository.branch)
        .bind(repository.enabled)
        .fetch_one(&self.pool)
        .await?;

        Ok(result)
    }

    pub async fn get_repository(&self, id: Uuid) -> Result<Option<Repository>> {
        let repository = sqlx::query_as::<_, Repository>(
            "SELECT id, name, url, repository_type, branch, enabled, last_crawled, created_at, updated_at FROM repositories WHERE id = $1"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(repository)
    }

    pub async fn list_repositories(&self) -> Result<Vec<Repository>> {
        let repositories = sqlx::query_as::<_, Repository>(
            "SELECT id, name, url, repository_type, branch, enabled, last_crawled, created_at, updated_at FROM repositories ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(repositories)
    }

    pub async fn update_last_crawled(&self, id: Uuid) -> Result<()> {
        sqlx::query(
            "UPDATE repositories SET last_crawled = NOW(), updated_at = NOW() WHERE id = $1"
        )
        .bind(id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
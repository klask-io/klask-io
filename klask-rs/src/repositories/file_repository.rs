use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;
use crate::models::File;

pub struct FileRepository {
    pool: PgPool,
}

impl FileRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn find_by_path(&self, repository_id: Uuid, path: &str) -> Result<Option<File>> {
        let file = sqlx::query_as::<_, File>(
            "SELECT id, name, path, content, project, version, extension, size, last_modified, created_at, updated_at FROM files WHERE repository_id = $1 AND path = $2"
        )
        .bind(repository_id)
        .bind(path)
        .fetch_optional(&self.pool)
        .await?;

        Ok(file)
    }

    pub async fn find_by_project(&self, project: &str, limit: Option<u32>) -> Result<Vec<File>> {
        let limit = limit.unwrap_or(50) as i64;
        
        let files = sqlx::query_as::<_, File>(
            "SELECT id, name, path, content, project, version, extension, size, last_modified, created_at, updated_at FROM files WHERE project = $1 ORDER BY created_at DESC LIMIT $2"
        )
        .bind(project)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(files)
    }

    pub async fn find_by_extension(&self, extension: &str, limit: Option<u32>) -> Result<Vec<File>> {
        let limit = limit.unwrap_or(50) as i64;
        
        let files = sqlx::query_as::<_, File>(
            "SELECT id, name, path, content, project, version, extension, size, last_modified, created_at, updated_at FROM files WHERE extension = $1 ORDER BY created_at DESC LIMIT $2"
        )
        .bind(extension)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(files)
    }
}

// For now, we'll implement a simplified version without the full Repository trait
impl FileRepository {
    pub async fn create_file(&self, file: &File, repository_id: Uuid) -> Result<File> {
        let result = sqlx::query_as::<_, File>(
            "INSERT INTO files (id, name, path, content, project, version, extension, size, repository_id, last_modified) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, name, path, content, project, version, extension, size, last_modified, created_at, updated_at"
        )
        .bind(file.id)
        .bind(&file.name)
        .bind(&file.path)
        .bind(&file.content)
        .bind(&file.project)
        .bind(&file.version)
        .bind(&file.extension)
        .bind(file.size)
        .bind(repository_id)
        .bind(file.last_modified)
        .fetch_one(&self.pool)
        .await?;

        Ok(result)
    }

    pub async fn get_file(&self, id: Uuid) -> Result<Option<File>> {
        let file = sqlx::query_as::<_, File>(
            "SELECT id, name, path, content, project, version, extension, size, last_modified, created_at, updated_at FROM files WHERE id = $1"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(file)
    }

    pub async fn list_files(&self, limit: Option<u32>, offset: Option<u32>) -> Result<Vec<File>> {
        let limit = limit.unwrap_or(50) as i64;
        let offset = offset.unwrap_or(0) as i64;
        
        let files = sqlx::query_as::<_, File>(
            "SELECT id, name, path, content, project, version, extension, size, last_modified, created_at, updated_at FROM files ORDER BY created_at DESC LIMIT $1 OFFSET $2"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        Ok(files)
    }
}
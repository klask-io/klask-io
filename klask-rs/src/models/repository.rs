use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Type};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Repository {
    pub id: Uuid,
    pub name: String,
    pub url: String,
    pub repository_type: RepositoryType,
    pub branch: Option<String>,
    pub enabled: bool,
    pub last_crawled: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Type)]
#[sqlx(type_name = "varchar")]
#[sqlx(rename_all = "PascalCase")]
pub enum RepositoryType {
    Git,
    GitLab,
    FileSystem,
}
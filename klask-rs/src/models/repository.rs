use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Type};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Repository {
    pub id: Uuid,
    pub name: String,
    pub url: String,
    #[serde(rename = "repositoryType")]
    pub repository_type: RepositoryType,
    pub branch: Option<String>,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(skip_deserializing)]
    #[serde(rename = "accessToken")]
    pub access_token: Option<String>,  // Store encrypted in DB, never send to frontend
    #[serde(rename = "gitlabNamespace")]
    pub gitlab_namespace: Option<String>,
    #[serde(rename = "isGroup")]
    pub is_group: bool,
    #[serde(rename = "lastCrawled")]
    pub last_crawled: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(rename = "createdAt")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(rename = "updatedAt")]
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
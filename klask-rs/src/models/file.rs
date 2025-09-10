use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct File {
    pub id: Uuid,
    pub name: String,
    pub path: String,
    pub content: Option<String>,
    pub project: String,
    pub version: String,
    pub extension: String,
    pub size: i64,
    pub last_modified: chrono::DateTime<chrono::Utc>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}
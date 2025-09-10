use anyhow::Result;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::auth::extractors::AppState;
use crate::repositories::FileRepository;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileResponse {
    pub id: Uuid,
    pub name: String,
    pub path: String,
    pub content: Option<String>,
    pub project: String,
    pub version: String,
    pub extension: String,
    pub size: i64,
}

#[derive(Debug, Deserialize)]
pub struct FileQueryParams {
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub project: Option<String>,
    pub version: Option<String>,
    pub extension: Option<String>,
}

pub async fn create_router() -> Result<Router<AppState>> {
    let router = Router::new()
        .route("/", get(list_files))
        .route("/:id", get(get_file));

    Ok(router)
}

async fn list_files(
    State(app_state): State<AppState>,
    Query(params): Query<FileQueryParams>,
) -> Result<Json<Vec<FileResponse>>, StatusCode> {
    let page = params.page.unwrap_or(1);
    let limit = params.limit.unwrap_or(50);
    let offset = (page - 1) * limit;
    
    let file_repo = FileRepository::new(app_state.database.pool().clone());
    
    match file_repo.list_files(Some(limit), Some(offset)).await {
        Ok(files) => {
            let responses: Vec<FileResponse> = files
                .into_iter()
                .map(|f| FileResponse {
                    id: f.id,
                    name: f.name,
                    path: f.path,
                    content: f.content,
                    project: f.project,
                    version: f.version,
                    extension: f.extension,
                    size: f.size,
                })
                .collect();
            Ok(Json(responses))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_file(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<FileResponse>, StatusCode> {
    let file_repo = FileRepository::new(app_state.database.pool().clone());
    
    match file_repo.get_file(id).await {
        Ok(Some(file)) => Ok(Json(FileResponse {
            id: file.id,
            name: file.name,
            path: file.path,
            content: file.content,
            project: file.project,
            version: file.version,
            extension: file.extension,
            size: file.size,
        })),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}
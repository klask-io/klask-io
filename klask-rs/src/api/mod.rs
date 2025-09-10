pub mod files;
pub mod search;
pub mod repositories;

use anyhow::Result;
use axum::{routing::get, Router};
use crate::database::Database;

pub async fn create_router(database: Database) -> Result<Router> {
    let router = Router::new()
        .route("/status", get(status_handler))
        .nest("/files", files::create_router(database.clone()).await?)
        .nest("/search", search::create_router(database.clone()).await?)
        .nest("/repositories", repositories::create_router(database.clone()).await?);

    Ok(router)
}

async fn status_handler() -> &'static str {
    "API is running"
}
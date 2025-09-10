pub mod files;
pub mod search;
pub mod repositories;

use anyhow::Result;
use axum::{routing::get, Router};

pub async fn create_router() -> Result<Router> {
    let router = Router::new()
        .route("/status", get(status_handler))
        .nest("/files", files::create_router().await?)
        .nest("/search", search::create_router().await?)
        .nest("/repositories", repositories::create_router().await?);

    Ok(router)
}

async fn status_handler() -> &'static str {
    "API is running"
}
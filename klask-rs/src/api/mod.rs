pub mod auth;
pub mod files;
pub mod search;
pub mod repositories;
pub mod users;

use anyhow::Result;
use axum::{routing::get, Router};
use crate::auth::extractors::AppState;

pub async fn create_router() -> Result<Router<AppState>> {
    let router = Router::new()
        .route("/status", get(status_handler))
        .nest("/auth", auth::create_router().await?)
        .nest("/files", files::create_router().await?)
        .nest("/search", search::create_router().await?)
        .nest("/repositories", repositories::create_router().await?)
        .nest("/users", users::create_router().await?);

    Ok(router)
}

async fn status_handler() -> &'static str {
    "API is running"
}
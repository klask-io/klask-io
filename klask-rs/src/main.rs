mod api;
mod config;
mod models;
mod services;

use anyhow::Result;
use axum::{routing::get, Router};
use config::AppConfig;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "klask_rs=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = AppConfig::new()?;
    let bind_address = format!("{}:{}", config.server.host, config.server.port);

    info!("Starting Klask-RS server on {}", bind_address);

    // Build application router
    let app = create_app().await?;

    // Create TCP listener
    let listener = tokio::net::TcpListener::bind(&bind_address).await?;
    
    info!("Server listening on http://{}", bind_address);
    
    // Start server
    axum::serve(listener, app).await?;

    Ok(())
}

async fn create_app() -> Result<Router> {
    let app = Router::new()
        .route("/", get(root_handler))
        .route("/health", get(health_handler))
        .nest("/api", api::create_router().await?)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    Ok(app)
}

async fn root_handler() -> &'static str {
    "Klask-RS: Modern Code Search Engine"
}

async fn health_handler() -> &'static str {
    "OK"
}

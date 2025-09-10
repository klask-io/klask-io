mod api;
mod config;
mod database;
mod models;
mod repositories;
mod services;

use anyhow::Result;
use axum::{routing::get, Router};
use config::AppConfig;
use database::Database;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::{info, error};
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

    // Initialize database
    let database = match Database::new(&config.database.url, config.database.max_connections).await {
        Ok(db) => {
            info!("Database connected successfully");
            db
        }
        Err(e) => {
            error!("Failed to connect to database: {}", e);
            info!("Continuing without database connection for development");
            // For development, we'll create a dummy database
            return Err(e);
        }
    };

    // Build application router
    let app = create_app(database).await?;

    // Create TCP listener
    let listener = tokio::net::TcpListener::bind(&bind_address).await?;
    
    info!("Server listening on http://{}", bind_address);
    
    // Start server
    axum::serve(listener, app).await?;

    Ok(())
}

async fn create_app(database: Database) -> Result<Router> {
    let app = Router::new()
        .route("/", get(root_handler))
        .route("/health", get({
            let db = database.clone();
            move || health_handler(db)
        }))
        .nest("/api", api::create_router(database).await?)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    Ok(app)
}

async fn root_handler() -> &'static str {
    "Klask-RS: Modern Code Search Engine"
}

async fn health_handler(database: Database) -> &'static str {
    match database.health_check().await {
        Ok(_) => "OK",
        Err(_) => "Database connection failed",
    }
}

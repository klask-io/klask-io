mod api;
mod auth;
mod config;
mod database;
mod models;
mod repositories;
mod services;

use anyhow::Result;
use axum::{routing::get, Router};
use config::AppConfig;
use database::Database;
use services::{SearchService, crawler::CrawlerService, progress::ProgressTracker, scheduler::SchedulerService};
use auth::{extractors::AppState, jwt::JwtService};
use tower_http::cors::CorsLayer;
use std::sync::Arc;
use std::collections::HashMap;
use std::time::Instant;
use tokio::sync::RwLock;
use tower_http::trace::TraceLayer;
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "klask_rs=debug,tower_http=debug,tantivy=warn".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Capture startup time
    let startup_time = Instant::now();
    
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

    // Initialize search service
    let search_service = match SearchService::new(&config.search.index_dir) {
        Ok(service) => {
            info!("Search service initialized successfully at {}", config.search.index_dir);
            service
        }
        Err(e) => {
            error!("Failed to initialize search service: {}", e);
            return Err(e);
        }
    };

    // Initialize JWT service
    let jwt_service = match JwtService::new(&config.auth) {
        Ok(service) => {
            info!("JWT service initialized successfully");
            service
        }
        Err(e) => {
            error!("Failed to initialize JWT service: {}", e);
            return Err(e);
        }
    };

    // Initialize progress tracker
    let progress_tracker = Arc::new(ProgressTracker::new());
    info!("Progress tracker initialized successfully");

    // Initialize crawler service
    let search_service_arc = Arc::new(search_service);
    let crawler_service = match CrawlerService::new(database.pool().clone(), search_service_arc.clone(), progress_tracker.clone()) {
        Ok(service) => {
            info!("Crawler service initialized successfully");
            service
        }
        Err(e) => {
            error!("Failed to initialize crawler service: {}", e);
            return Err(e);
        }
    };

    // Initialize scheduler service
    let crawler_service_arc = Arc::new(crawler_service);
    let scheduler_service = match SchedulerService::new(database.pool().clone(), crawler_service_arc.clone()).await {
        Ok(service) => {
            info!("Scheduler service initialized successfully");
            // Start the scheduler
            if let Err(e) = service.start().await {
                error!("Failed to start scheduler service: {}", e);
            } else {
                info!("Scheduler service started successfully");
            }
            service
        }
        Err(e) => {
            error!("Failed to initialize scheduler service: {}", e);
            return Err(e);
        }
    };

    // Create application state
    let app_state = AppState {
        database,
        search_service: search_service_arc,
        crawler_service: crawler_service_arc,
        progress_tracker,
        scheduler_service: Some(Arc::new(scheduler_service)),
        jwt_service,
        config: config.clone(),
        crawl_tasks: Arc::new(RwLock::new(HashMap::new())),
        startup_time,
    };

    // Build application router
    let app = create_app(app_state).await?;

    // Create TCP listener
    let listener = tokio::net::TcpListener::bind(&bind_address).await?;
    
    info!("Server listening on http://{}", bind_address);
    
    // Start server
    axum::serve(listener, app).await?;

    Ok(())
}

async fn create_app(app_state: AppState) -> Result<Router> {
    let app = Router::new()
        .route("/", get(root_handler))
        .route("/health", get({
            let db = app_state.database.clone();
            move || health_handler(db)
        }))
        .nest("/api", api::create_router().await?)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(app_state);

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

use crate::auth::{claims::TokenClaims, errors::AuthError, jwt::JwtService};
use crate::database::Database;
use crate::models::user::{User, UserRole};
use crate::repositories::user_repository::UserRepository;
use crate::services::{encryption::EncryptionService, progress::ProgressTracker};
use axum::{async_trait, extract::FromRequestParts, http::request::Parts};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;
use tracing::{debug, error, warn};
use uuid::Uuid;

// Application state that will be shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub database: Database,
    pub search_service: Arc<crate::services::SearchService>,
    pub crawler_service: Arc<crate::services::crawler::CrawlerService>,
    pub progress_tracker: Arc<ProgressTracker>,
    pub scheduler_service: Option<Arc<crate::services::scheduler::SchedulerService>>,
    pub jwt_service: JwtService,
    pub encryption_service: Arc<EncryptionService>,
    #[allow(dead_code)]
    pub config: crate::config::AppConfig,
    #[allow(dead_code)]
    pub crawl_tasks: Arc<RwLock<HashMap<Uuid, tokio::task::JoinHandle<()>>>>,
    pub startup_time: Instant,
}

#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub user: User,
    #[allow(dead_code)]
    pub claims: TokenClaims,
}

#[async_trait]
impl FromRequestParts<AppState> for AuthenticatedUser {
    type Rejection = AuthError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        debug!("Extracting AuthenticatedUser from request");
        // Extract app state
        let app_state = state;

        // Extract token from Authorization header
        let token = match extract_token_from_header(parts) {
            Ok(t) => {
                debug!("Token extracted from header");
                t
            }
            Err(e) => {
                debug!("Failed to extract token: {:?}", e);
                return Err(e);
            }
        };

        // Decode and validate token
        let claims = app_state.jwt_service.decode_token(&token).map_err(|e| {
            error!("Failed to decode token: {:?}", e);
            AuthError::InvalidToken(e.to_string())
        })?;

        debug!("Token decoded successfully for user ID: {}", claims.sub);

        // Check if token is expired
        if claims.is_expired() {
            warn!("Token expired for user ID: {}", claims.sub);
            return Err(AuthError::TokenExpired);
        }

        // Fetch user from database
        let user_repo = UserRepository::new(app_state.database.pool().clone());
        let user = user_repo
            .get_user(claims.sub)
            .await
            .map_err(|e| {
                error!("Database error while fetching user {}: {:?}", claims.sub, e);
                AuthError::DatabaseError(e.to_string())
            })?
            .ok_or_else(|| {
                warn!("User not found for ID: {}", claims.sub);
                AuthError::UserNotFound
            })?;

        debug!("User found: {}", user.username);

        // Verify user is active
        if !user.active {
            warn!("Inactive user attempted to authenticate: {}", user.username);
            return Err(AuthError::UserInactive);
        }

        debug!(
            "AuthenticatedUser extracted successfully: {}",
            user.username
        );
        Ok(AuthenticatedUser { user, claims })
    }
}

// Role-based authentication extractor for admin users
#[derive(Debug, Clone)]
pub struct AdminUser(pub AuthenticatedUser);

#[async_trait]
impl FromRequestParts<AppState> for AdminUser {
    type Rejection = AuthError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        debug!("Attempting to extract AdminUser from request");

        let auth_user = match AuthenticatedUser::from_request_parts(parts, state).await {
            Ok(user) => {
                debug!("Authenticated user extracted: {:?}", user.user.username);
                user
            }
            Err(e) => {
                error!("Failed to extract authenticated user: {:?}", e);
                return Err(e);
            }
        };

        if auth_user.user.role != UserRole::Admin {
            warn!(
                "User {} attempted to access admin endpoint without admin role",
                auth_user.user.username
            );
            return Err(AuthError::InsufficientPermissions);
        }

        debug!(
            "AdminUser extracted successfully for user: {}",
            auth_user.user.username
        );
        Ok(AdminUser(auth_user))
    }
}

// Optional authentication extractor for endpoints that can work with or without auth
#[allow(dead_code)]
pub struct OptionalUser(pub Option<AuthenticatedUser>);

#[async_trait]
impl FromRequestParts<AppState> for OptionalUser {
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        match AuthenticatedUser::from_request_parts(parts, state).await {
            Ok(user) => Ok(OptionalUser(Some(user))),
            Err(_) => Ok(OptionalUser(None)),
        }
    }
}

fn extract_token_from_header(parts: &Parts) -> Result<String, AuthError> {
    let auth_header = parts
        .headers
        .get("authorization")
        .ok_or(AuthError::MissingAuthHeader)?
        .to_str()
        .map_err(|_| AuthError::InvalidAuthHeader)?;

    if let Some(token) = auth_header.strip_prefix("Bearer ") {
        Ok(token.to_string())
    } else {
        Err(AuthError::InvalidAuthHeader)
    }
}

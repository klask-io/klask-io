use axum::{
    async_trait,
    extract::FromRequestParts,
    http::request::Parts,
};
use std::sync::Arc;
use crate::auth::{claims::TokenClaims, errors::AuthError, jwt::JwtService};
use crate::models::user::{User, UserRole};
use crate::database::Database;
use crate::repositories::user_repository::UserRepository;

// Application state that will be shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub database: Database,
    pub search_service: Arc<crate::services::SearchService>,
    pub crawler_service: Arc<crate::services::crawler::CrawlerService>,
    pub jwt_service: JwtService,
    pub config: crate::config::AppConfig,
}

#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub user: User,
    pub claims: TokenClaims,
}

#[async_trait]
impl FromRequestParts<AppState> for AuthenticatedUser 
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        // Extract app state  
        let app_state = state;

        // Extract token from Authorization header
        let token = extract_token_from_header(parts)?;

        // Decode and validate token
        let claims = app_state.jwt_service
            .decode_token(&token)
            .map_err(|e| AuthError::InvalidToken(e.to_string()))?;

        // Check if token is expired
        if claims.is_expired() {
            return Err(AuthError::TokenExpired);
        }

        // Fetch user from database
        let user_repo = UserRepository::new(app_state.database.pool().clone());
        let user = user_repo
            .get_user(claims.sub)
            .await
            .map_err(|e| AuthError::DatabaseError(e.to_string()))?
            .ok_or(AuthError::UserNotFound)?;

        // Verify user is active
        if !user.active {
            return Err(AuthError::UserInactive);
        }

        Ok(AuthenticatedUser { user, claims })
    }
}

// Role-based authentication extractor for admin users
#[derive(Debug, Clone)]
pub struct AdminUser(pub AuthenticatedUser);

#[async_trait]
impl FromRequestParts<AppState> for AdminUser 
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let auth_user = AuthenticatedUser::from_request_parts(parts, state).await?;
        
        if auth_user.user.role != UserRole::Admin {
            return Err(AuthError::InsufficientPermissions);
        }

        Ok(AdminUser(auth_user))
    }
}

// Optional authentication extractor for endpoints that can work with or without auth
pub struct OptionalUser(pub Option<AuthenticatedUser>);

#[async_trait]
impl FromRequestParts<AppState> for OptionalUser 
{
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
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
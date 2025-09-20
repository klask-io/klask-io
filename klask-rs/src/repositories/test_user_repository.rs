#[cfg(any(test, debug_assertions))]
use anyhow::Result;
#[cfg(any(test, debug_assertions))]
use sqlx::{Pool, Sqlite, Row};
#[cfg(any(test, debug_assertions))]
use crate::models::{User, UserRole};
#[cfg(any(test, debug_assertions))]
use uuid::Uuid;

#[cfg(any(test, debug_assertions))]
pub struct TestUserRepository {
    pool: Pool<Sqlite>,
}

#[cfg(any(test, debug_assertions))]
impl TestUserRepository {
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    pub async fn create_user(&self, user: &User) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO users (id, username, email, password_hash, role, active, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#,
        )
        .bind(user.id.to_string())
        .bind(&user.username)
        .bind(&user.email)
        .bind(&user.password_hash)
        .bind(user.role.to_string())
        .bind(user.active)
        .bind(user.created_at)
        .bind(user.updated_at)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_user(&self, id: Uuid) -> Result<Option<User>> {
        let row = sqlx::query(
            "SELECT id, username, email, password_hash, role, active, created_at, updated_at FROM users WHERE id = ?1"
        )
        .bind(id.to_string())
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            let user = User {
                id: Uuid::parse_str(&row.get::<String, _>("id"))?,
                username: row.get("username"),
                email: row.get("email"),
                password_hash: row.get("password_hash"),
                role: row.get::<String, _>("role").parse::<UserRole>().unwrap_or(UserRole::User),
                active: row.get("active"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            };
            Ok(Some(user))
        } else {
            Ok(None)
        }
    }

    pub async fn get_user_stats(&self) -> Result<crate::repositories::user_repository::UserStats> {
        let total_users: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
            .fetch_one(&self.pool)
            .await?;

        let active_users: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE active = true")
            .fetch_one(&self.pool)
            .await?;

        let admin_users: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE role = 'Admin'")
            .fetch_one(&self.pool)
            .await?;

        let recent_registrations: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM users WHERE created_at > datetime('now', '-7 days')"
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(crate::repositories::user_repository::UserStats {
            total_users,
            active_users,
            admin_users,
            recent_registrations,
        })
    }
}
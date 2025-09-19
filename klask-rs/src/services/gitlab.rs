use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct GitLabService {
    client: Client,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitLabProject {
    pub id: i64,
    pub name: String,
    pub path_with_namespace: String,
    pub description: Option<String>,
    pub default_branch: Option<String>,
    pub http_url_to_repo: String,
    pub ssh_url_to_repo: String,
    pub web_url: String,
    pub visibility: String,
    pub archived: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitLabGroup {
    pub id: i64,
    pub name: String,
    pub path: String,
    pub full_path: String,
    pub description: Option<String>,
    pub visibility: String,
}

impl GitLabService {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    /// Discover all accessible projects for a GitLab instance
    pub async fn discover_projects(
        &self,
        gitlab_url: &str,
        access_token: &str,
        namespace: Option<&str>,
    ) -> Result<Vec<GitLabProject>> {
        let mut projects = Vec::new();
        let mut page = 1;
        let per_page = 100;

        loop {
            let mut url = format!(
                "{}/api/v4/projects?page={}&per_page={}&membership=true&simple=false",
                gitlab_url.trim_end_matches('/'),
                page,
                per_page
            );

            // If namespace is provided, filter by it
            if let Some(ns) = namespace {
                url.push_str(&format!("&search_namespaces=true&search={}", ns));
            }

            tracing::debug!("Making GitLab API request to: {}", url);
            let response = self
                .client
                .get(&url)
                .header("Authorization", format!("Bearer {}", access_token))
                .send()
                .await
                .context("Failed to fetch GitLab projects")?;

            let status = response.status();
            if !status.is_success() {
                let error_body = response.text().await.unwrap_or_default();
                tracing::error!(
                    "GitLab API request failed - URL: {}, Status: {}, Body: {}",
                    url,
                    status,
                    error_body
                );
                return Err(anyhow::anyhow!(
                    "GitLab API error: {} - {}",
                    status,
                    error_body
                ));
            }

            let page_projects: Vec<GitLabProject> = response
                .json()
                .await
                .context("Failed to parse GitLab projects response")?;

            if page_projects.is_empty() {
                break;
            }

            projects.extend(page_projects);
            page += 1;

            // GitLab has a limit, stop at reasonable number
            if page > 10 || projects.len() > 1000 {
                break;
            }
        }

        // Filter out archived projects
        projects.retain(|p| !p.archived);

        Ok(projects)
    }

    /// Get all projects in a specific group
    pub async fn get_group_projects(
        &self,
        gitlab_url: &str,
        access_token: &str,
        group_id: &str,
    ) -> Result<Vec<GitLabProject>> {
        let mut projects = Vec::new();
        let mut page = 1;
        let per_page = 100;

        loop {
            let url = format!(
                "{}/api/v4/groups/{}/projects?page={}&per_page={}&include_subgroups=true&archived=false",
                gitlab_url.trim_end_matches('/'),
                group_id,
                page,
                per_page
            );

            let response = self
                .client
                .get(&url)
                .header("Authorization", format!("Bearer {}", access_token))
                .send()
                .await
                .context("Failed to fetch GitLab group projects")?;

            if !response.status().is_success() {
                return Err(anyhow::anyhow!(
                    "GitLab API error: {} - {}",
                    response.status(),
                    response.text().await.unwrap_or_default()
                ));
            }

            let page_projects: Vec<GitLabProject> = response
                .json()
                .await
                .context("Failed to parse GitLab group projects response")?;

            if page_projects.is_empty() {
                break;
            }

            projects.extend(page_projects);
            page += 1;

            // Stop at reasonable number
            if page > 10 || projects.len() > 1000 {
                break;
            }
        }

        Ok(projects)
    }

    /// Get information about a specific project
    pub async fn get_project(
        &self,
        gitlab_url: &str,
        access_token: &str,
        project_id: &str,
    ) -> Result<GitLabProject> {
        let url = format!(
            "{}/api/v4/projects/{}",
            gitlab_url.trim_end_matches('/'),
            urlencoding::encode(project_id)
        );

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await
            .context("Failed to fetch GitLab project")?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "GitLab API error: {} - {}",
                response.status(),
                response.text().await.unwrap_or_default()
            ));
        }

        let project: GitLabProject = response
            .json()
            .await
            .context("Failed to parse GitLab project response")?;

        Ok(project)
    }

    /// Test if the access token is valid
    pub async fn test_token(&self, gitlab_url: &str, access_token: &str) -> Result<bool> {
        let url = format!("{}/api/v4/user", gitlab_url.trim_end_matches('/'));

        tracing::debug!("Testing GitLab token with URL: {}", url);
        let response = self
            .client
            .get(&url)
            .header("PRIVATE-TOKEN", access_token)
            .send()
            .await
            .context("Failed to test GitLab token")?;

        let status = response.status();
        if status.is_success() {
            tracing::info!("GitLab token test successful: {}", status);
            Ok(true)
        } else {
            let error_body = response.text().await.unwrap_or_default();
            tracing::error!(
                "GitLab token test failed - URL: {}, Status: {}, Body: {}",
                url,
                status,
                error_body
            );
            Ok(false)
        }
    }
}

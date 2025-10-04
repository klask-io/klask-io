use crate::auth::extractors::AppState;
use crate::services::SearchQuery;
use anyhow::Result;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use tracing;

// Cache for search filters to avoid expensive recalculations
struct FilterCache {
    data: Option<SearchFilters>,
    timestamp: Instant,
}

lazy_static::lazy_static! {
    static ref FILTER_CACHE: Arc<RwLock<FilterCache>> = Arc::new(RwLock::new(FilterCache {
        data: None,
        timestamp: Instant::now() - Duration::from_secs(600), // Start expired
    }));
}

const CACHE_TTL: Duration = Duration::from_secs(5 * 60); // 5 minutes

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchRequest {
    pub q: Option<String>,
    pub query: Option<String>,
    #[serde(alias = "max_results")]
    pub limit: Option<u32>,
    pub page: Option<u32>,
    // Multi-select filters as comma-separated strings
    pub projects: Option<String>,
    pub versions: Option<String>,
    pub extensions: Option<String>,
    pub include_facets: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    pub total: u64,
    pub page: u32,
    pub limit: u32,
    pub facets: Option<SearchFacets>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchFacets {
    pub projects: Vec<FacetValue>,
    pub versions: Vec<FacetValue>,
    pub extensions: Vec<FacetValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FacetValue {
    pub value: String,
    pub count: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub file_id: String,
    pub doc_address: String,
    pub name: String,
    pub path: String,
    pub content_snippet: String,
    pub project: String,
    pub version: String,
    pub extension: String,
    pub score: f32,
    pub line_number: Option<u32>,
}

pub async fn create_router() -> Result<Router<AppState>> {
    let router = Router::new()
        .route("/", get(search_files))
        .route("/filters", get(get_search_filters));

    Ok(router)
}

async fn search_files(
    State(app_state): State<AppState>,
    Query(params): Query<SearchRequest>,
) -> Result<Json<SearchResponse>, StatusCode> {
    tracing::debug!("Search request params: {:?}", params);

    let page = params.page.unwrap_or(1);
    let limit = params.limit.unwrap_or(50).min(1000); // Cap at 1000 results max
    let offset = (page - 1) * limit;

    // Get search query from either 'q' or 'query' parameter
    let query_string = params.q.or(params.query).ok_or(StatusCode::BAD_REQUEST)?;

    // Build search query - filters are already comma-separated strings
    let search_query = SearchQuery {
        query: query_string,
        project_filter: params.projects,
        version_filter: params.versions,
        extension_filter: params.extensions,
        limit: limit as usize,
        offset: offset as usize,
        include_facets: params.include_facets.unwrap_or(false),
    };

    // Perform search using Tantivy
    match app_state.search_service.search(search_query).await {
        Ok(search_response) => {
            let results: Vec<SearchResult> = search_response
                .results
                .into_iter()
                .map(|r| SearchResult {
                    id: r.file_id.to_string(),
                    file_id: r.file_id.to_string(),
                    doc_address: r.doc_address,
                    name: r.file_name,
                    path: r.file_path,
                    content_snippet: r.content_snippet,
                    project: r.project,
                    version: r.version,
                    extension: r.extension,
                    score: r.score,
                    line_number: r.line_number,
                })
                .collect();

            // Convert facets to API format if present
            let facets = search_response.facets.map(|service_facets| SearchFacets {
                projects: service_facets
                    .projects
                    .into_iter()
                    .map(|(value, count)| FacetValue { value, count })
                    .collect(),
                versions: service_facets
                    .versions
                    .into_iter()
                    .map(|(value, count)| FacetValue { value, count })
                    .collect(),
                extensions: service_facets
                    .extensions
                    .into_iter()
                    .map(|(value, count)| FacetValue { value, count })
                    .collect(),
            });

            let response = SearchResponse {
                total: search_response.total,
                results,
                page,
                limit,
                facets,
            };

            Ok(Json(response))
        }
        Err(e) => {
            tracing::error!("Search failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFilters {
    pub projects: Vec<FacetValue>,
    pub versions: Vec<FacetValue>,
    pub extensions: Vec<FacetValue>,
}

async fn get_search_filters(
    State(app_state): State<AppState>,
) -> Result<Json<SearchFilters>, StatusCode> {
    // Check cache first
    {
        let cache = FILTER_CACHE.read().unwrap();
        if let Some(ref cached_data) = cache.data {
            if cache.timestamp.elapsed() < CACHE_TTL {
                return Ok(Json(cached_data.clone()));
            }
        }
    }

    // Get all facets by performing an empty search
    let search_query = SearchQuery {
        query: "*".to_string(), // Match all documents
        project_filter: None,
        version_filter: None,
        extension_filter: None,
        limit: 0, // We only need facets, not results
        offset: 0,
        include_facets: true, // Always include facets for the filters endpoint
    };

    match app_state.search_service.search(search_query).await {
        Ok(search_response) => {
            if let Some(facets) = search_response.facets {
                let filters = SearchFilters {
                    projects: facets
                        .projects
                        .into_iter()
                        .map(|(value, count)| FacetValue { value, count })
                        .collect(),
                    versions: facets
                        .versions
                        .into_iter()
                        .map(|(value, count)| FacetValue { value, count })
                        .collect(),
                    extensions: facets
                        .extensions
                        .into_iter()
                        .map(|(value, count)| FacetValue { value, count })
                        .collect(),
                };

                // Update cache
                {
                    let mut cache = FILTER_CACHE.write().unwrap();
                    cache.data = Some(filters.clone());
                    cache.timestamp = Instant::now();
                }

                Ok(Json(filters))
            } else {
                // No facets available, return empty filters
                Ok(Json(SearchFilters {
                    projects: vec![],
                    versions: vec![],
                    extensions: vec![],
                }))
            }
        }
        Err(e) => {
            tracing::error!("Failed to get search filters: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

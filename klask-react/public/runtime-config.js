// Default runtime configuration for local development
// This file will be overwritten by Docker entrypoint in production
window.RUNTIME_CONFIG = {
  // Use build-time environment variables in dev mode
  // The actual config will use getApiBaseUrl() fallback logic
};
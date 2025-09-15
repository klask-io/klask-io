-- Add access_token field to repositories table for secure API authentication
ALTER TABLE repositories 
ADD COLUMN access_token TEXT,
ADD COLUMN gitlab_namespace TEXT,
ADD COLUMN is_group BOOLEAN DEFAULT FALSE;

-- Add index for faster lookups by namespace
CREATE INDEX idx_repositories_gitlab_namespace ON repositories(gitlab_namespace);

-- Comment on the access_token column for documentation
COMMENT ON COLUMN repositories.access_token IS 'Encrypted access token for API authentication (GitLab, GitHub, etc.)';
COMMENT ON COLUMN repositories.gitlab_namespace IS 'GitLab namespace (username or group) for bulk repository discovery';
COMMENT ON COLUMN repositories.is_group IS 'Whether this represents a GitLab group (for bulk import)';
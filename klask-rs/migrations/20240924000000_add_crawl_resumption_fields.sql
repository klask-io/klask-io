-- Add crawl resumption fields to repositories table
ALTER TABLE repositories ADD COLUMN crawl_state VARCHAR(50);
ALTER TABLE repositories ADD COLUMN last_processed_project TEXT;
ALTER TABLE repositories ADD COLUMN crawl_started_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN repositories.crawl_state IS 'Track current crawl state: idle, in_progress, failed';
COMMENT ON COLUMN repositories.last_processed_project IS 'Last processed project for resumption: GitLab project path, Git branch, or null for FileSystem';
COMMENT ON COLUMN repositories.crawl_started_at IS 'When current crawl started, used to detect abandoned crawls';
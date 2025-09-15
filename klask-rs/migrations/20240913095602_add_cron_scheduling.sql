-- Add cron scheduling fields to repositories table
ALTER TABLE repositories ADD COLUMN auto_crawl_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE repositories ADD COLUMN cron_schedule VARCHAR(100); -- e.g., "0 0 2 * * *" for daily at 2am
ALTER TABLE repositories ADD COLUMN next_crawl_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE repositories ADD COLUMN crawl_frequency_hours INTEGER; -- alternative to cron for simple intervals
ALTER TABLE repositories ADD COLUMN max_crawl_duration_minutes INTEGER DEFAULT 60; -- safety timeout

-- Add index for efficient querying of scheduled repositories
CREATE INDEX idx_repositories_auto_crawl ON repositories(auto_crawl_enabled, next_crawl_at) WHERE auto_crawl_enabled = TRUE;
CREATE INDEX idx_repositories_cron_schedule ON repositories(cron_schedule) WHERE cron_schedule IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN repositories.auto_crawl_enabled IS 'Whether automatic crawling is enabled for this repository';
COMMENT ON COLUMN repositories.cron_schedule IS 'Cron expression for crawl schedule (e.g., "0 0 2 * * *" for daily at 2am)';
COMMENT ON COLUMN repositories.next_crawl_at IS 'Next scheduled crawl time (calculated from cron schedule)';
COMMENT ON COLUMN repositories.crawl_frequency_hours IS 'Simple interval-based crawling frequency in hours (alternative to cron)';
COMMENT ON COLUMN repositories.max_crawl_duration_minutes IS 'Maximum allowed crawl duration before timeout (safety measure)';
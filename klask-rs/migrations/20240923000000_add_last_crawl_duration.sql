-- Add last_crawl_duration_seconds column to repositories table
-- This will store the duration in seconds of the last successful crawl

ALTER TABLE repositories 
ADD COLUMN last_crawl_duration_seconds INTEGER;

-- Add comment to document the field
COMMENT ON COLUMN repositories.last_crawl_duration_seconds IS 'Duration in seconds of the last successful crawl';
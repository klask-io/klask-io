-- Remove files table as we now store files only in Tantivy search index
-- This migration removes the files table and its constraints

-- Drop indexes first
DROP INDEX IF EXISTS idx_files_name;
DROP INDEX IF EXISTS idx_files_path;
DROP INDEX IF EXISTS idx_files_project;
DROP INDEX IF EXISTS idx_files_version;
DROP INDEX IF EXISTS idx_files_extension;
DROP INDEX IF EXISTS idx_files_repository_id;

-- Drop trigger
DROP TRIGGER IF EXISTS update_files_updated_at ON files;

-- Drop table
DROP TABLE IF EXISTS files;
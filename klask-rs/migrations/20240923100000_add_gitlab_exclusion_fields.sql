-- Add GitLab exclusion fields to repositories table

ALTER TABLE repositories 
  ADD COLUMN gitlab_excluded_projects TEXT,
  ADD COLUMN gitlab_excluded_patterns TEXT;
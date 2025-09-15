-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'User',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Repositories table
CREATE TABLE repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    repository_type VARCHAR(20) NOT NULL, -- Git, GitLab, FileSystem
    branch VARCHAR(255),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_crawled TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Files table
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    path TEXT NOT NULL,
    content TEXT, -- Store file content for search indexing
    project VARCHAR(255) NOT NULL,
    version VARCHAR(255) NOT NULL,
    extension VARCHAR(50) NOT NULL,
    size BIGINT NOT NULL,
    repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
    last_modified TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Create unique constraint for path within a repository
    UNIQUE(repository_id, path)
);

-- Indexes for better performance
CREATE INDEX idx_files_name ON files(name);
CREATE INDEX idx_files_path ON files(path);
CREATE INDEX idx_files_project ON files(project);
CREATE INDEX idx_files_version ON files(version);
CREATE INDEX idx_files_extension ON files(extension);
CREATE INDEX idx_files_repository_id ON files(repository_id);
CREATE INDEX idx_repositories_name ON repositories(name);
CREATE INDEX idx_repositories_type ON repositories(repository_type);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repositories_updated_at BEFORE UPDATE ON repositories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

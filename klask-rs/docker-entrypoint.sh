#!/bin/bash
set -e

# Function to log with timestamp
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [entrypoint] $1"
}

log "🚀 Starting Klask backend entrypoint..."

# Fix permissions for mounted volumes if they exist
if [ -d "/app/index" ]; then
    log "📁 Fixing permissions for /app/index"
    chown -R klask:klask /app/index
    chmod -R 755 /app/index
fi

if [ -d "/app/repositories" ]; then
    log "📁 Fixing permissions for /app/repositories"
    chown -R klask:klask /app/repositories
    chmod -R 755 /app/repositories
fi

# Create search index directory if it doesn't exist
if [ -n "$SEARCH_INDEX_DIR" ] && [ ! -d "$SEARCH_INDEX_DIR" ]; then
    log "📁 Creating search index directory: $SEARCH_INDEX_DIR"
    mkdir -p "$SEARCH_INDEX_DIR"
    chown -R klask:klask "$SEARCH_INDEX_DIR"
    chmod -R 755 "$SEARCH_INDEX_DIR"
fi

log "✅ Permissions fixed, switching to user 'klask'"

# Switch to klask user and execute the main command
exec gosu klask "$@"
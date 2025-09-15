#!/bin/bash

# Klask Development Server Startup Script
# This script helps you start both frontend and backend for testing

set -e

echo "🚀 Starting Klask Development Environment"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is available
port_available() {
    ! nc -z localhost $1 2>/dev/null
}

echo -e "${BLUE}Step 1: Checking Prerequisites${NC}"

# Check Rust
if command_exists cargo; then
    echo -e "${GREEN}✓ Rust is installed${NC}"
else
    echo -e "${RED}✗ Rust is not installed. Please install from https://rustup.rs/${NC}"
    exit 1
fi

# Check Node.js
if command_exists node; then
    echo -e "${GREEN}✓ Node.js is installed${NC}"
else
    echo -e "${RED}✗ Node.js is not installed. Please install from https://nodejs.org/${NC}"
    exit 1
fi

# Check Docker (optional)
if command_exists docker; then
    echo -e "${GREEN}✓ Docker is available${NC}"
    DOCKER_AVAILABLE=true
else
    echo -e "${YELLOW}⚠ Docker not found. You'll need to run PostgreSQL manually${NC}"
    DOCKER_AVAILABLE=false
fi

echo -e "\n${BLUE}Step 2: Database Setup${NC}"

if [ "$DOCKER_AVAILABLE" = true ]; then
    echo -e "${YELLOW}Starting PostgreSQL with Docker...${NC}"
    cd klask-rs
    docker-compose -f docker-compose.dev.yml up -d
    
    echo "Waiting for PostgreSQL to be ready..."
    sleep 10
    
    if docker-compose -f docker-compose.dev.yml ps | grep -q "Up"; then
        echo -e "${GREEN}✓ PostgreSQL is running${NC}"
    else
        echo -e "${RED}✗ Failed to start PostgreSQL${NC}"
        exit 1
    fi
    cd ..
else
    echo -e "${YELLOW}Please ensure PostgreSQL is running with these settings:${NC}"
    echo "  Database: klask_dev"
    echo "  User: klask_user"
    echo "  Password: klask_password"
    echo "  Port: 5432"
    echo ""
    read -p "Press Enter when PostgreSQL is ready..."
fi

echo -e "\n${BLUE}Step 3: Backend Setup${NC}"

# Check if .env exists
if [ ! -f "klask-rs/.env" ]; then
    echo -e "${YELLOW}Creating .env file from example...${NC}"
    cp klask-rs/.env.example klask-rs/.env
    echo -e "${GREEN}✓ Created .env file. You may want to customize it.${NC}"
fi

# Check backend port
if ! port_available 8080; then
    echo -e "${RED}✗ Port 8080 is already in use. Please free it first.${NC}"
    exit 1
fi

echo -e "${YELLOW}Installing Rust dependencies and running migrations...${NC}"
cd klask-rs

if cargo build; then
    echo -e "${GREEN}✓ Rust dependencies installed${NC}"
else
    echo -e "${RED}✗ Failed to build Rust project${NC}"
    exit 1
fi

# Run migrations if sqlx-cli is available
if command_exists sqlx; then
    echo "Running database migrations..."
    sqlx migrate run
    echo -e "${GREEN}✓ Database migrations completed${NC}"
else
    echo -e "${YELLOW}⚠ sqlx-cli not found. You may need to run migrations manually${NC}"
    echo "  Install: cargo install sqlx-cli"
    echo "  Run: sqlx migrate run"
fi

echo -e "${YELLOW}Starting Rust backend...${NC}"
cargo run --bin klask-rs &
BACKEND_PID=$!
cd ..

echo -e "\n${BLUE}Step 4: Frontend Setup${NC}"

# Check frontend port
if ! port_available 5173; then
    echo -e "${RED}✗ Port 5173 is already in use. Please free it first.${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# Check if .env exists
if [ ! -f "klask-react/.env" ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cp klask-react/.env.example klask-react/.env
    echo -e "${GREEN}✓ Created .env file${NC}"
fi

echo -e "${YELLOW}Installing Node.js dependencies...${NC}"
cd klask-react

if npm install; then
    echo -e "${GREEN}✓ Node.js dependencies installed${NC}"
else
    echo -e "${RED}✗ Failed to install Node.js dependencies${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo -e "${YELLOW}Starting React frontend...${NC}"
npm run dev &
FRONTEND_PID=$!
cd ..

echo -e "\n${GREEN}🎉 Development Environment Started!${NC}"
echo "========================================"
echo -e "${BLUE}Frontend:${NC} http://localhost:5173"
echo -e "${BLUE}Backend:${NC}  http://localhost:3000"
echo -e "${BLUE}API Health:${NC} http://localhost:3000/health"
echo ""
echo -e "${YELLOW}Test Authentication:${NC}"
echo "1. Go to http://localhost:5173/register"
echo "2. Create an account with:"
echo "   - Username: testuser"
echo "   - Email: test@example.com"
echo "   - Password: TestPass123"
echo "3. Try logging in at http://localhost:5173/login"
echo ""
echo -e "${YELLOW}To stop the servers:${NC}"
echo "Press Ctrl+C to stop this script"

# Wait for Ctrl+C
trap 'echo -e "\n${YELLOW}Stopping servers...${NC}"; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; exit 0' INT

# Keep script running
wait
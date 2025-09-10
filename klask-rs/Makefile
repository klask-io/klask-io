# Klask-RS Development Makefile

.PHONY: help dev dev-db dev-full test clean build docker-up docker-down migrate

# Default target
help:
	@echo "Klask-RS Development Commands:"
	@echo ""
	@echo "  dev          - Start development server (requires running database)"
	@echo "  dev-db       - Start only PostgreSQL database"
	@echo "  dev-full     - Start database + tools (pgAdmin, Redis)"
	@echo "  test         - Run all tests"
	@echo "  migrate      - Run database migrations"
	@echo "  build        - Build the application"
	@echo "  clean        - Clean build artifacts"
	@echo "  docker-up    - Start all Docker services"
	@echo "  docker-down  - Stop all Docker services"
	@echo ""

# Development commands
dev:
	cargo run

dev-db:
	docker-compose up -d postgres

dev-full:
	docker-compose --profile tools up -d

# Testing
test:
	cargo test

# Database operations
migrate:
	@echo "Waiting for database to be ready..."
	@until docker-compose exec postgres pg_isready -U klask -d klask_rs; do sleep 1; done
	sqlx migrate run

# Build commands
build:
	cargo build --release

clean:
	cargo clean
	docker-compose down -v

# Docker operations
docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

# Setup for new developers
setup: dev-db
	@echo "Waiting for database to be ready..."
	@sleep 5
	$(MAKE) migrate
	@echo ""
	@echo "Setup complete! You can now run 'make dev' to start the server."
	@echo "Database: postgres://klask:klask@localhost:5432/klask_rs"
	@echo "pgAdmin: http://localhost:8080 (admin@klask.io / admin)"
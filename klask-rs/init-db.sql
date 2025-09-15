-- This file initializes the database for development
-- The migrations will handle the actual schema creation

-- Create the database if it doesn't exist
SELECT 'CREATE DATABASE klask_dev'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'klask_dev');
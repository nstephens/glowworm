-- MySQL initialization script for Glowworm
-- This script sets up the database and user

-- Create the database
CREATE DATABASE IF NOT EXISTS glowworm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create the application user
CREATE USER IF NOT EXISTS 'glowworm'@'%' IDENTIFIED BY '${MYSQL_PASSWORD}';

-- Grant privileges
GRANT ALL PRIVILEGES ON glowworm.* TO 'glowworm'@'%';

-- Flush privileges
FLUSH PRIVILEGES;

-- Use the database
USE glowworm;

-- Create initial tables will be handled by Alembic migrations
-- This script just ensures the database and user exist


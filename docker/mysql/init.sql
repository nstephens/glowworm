-- MySQL initialization script for Glowworm
-- This script sets up the database schema
--
-- NOTE: The 'glowworm' user and database are created automatically by MySQL
-- via MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE environment variables
-- in docker-compose.yml. No need to create them here.

-- Use the database (already created by MySQL from MYSQL_DATABASE env var)
USE glowworm;

-- Database schema will be created by Alembic migrations on backend startup
-- This init.sql can contain any custom SQL for initial setup if needed


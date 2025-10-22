#!/bin/bash
# Backend startup script - runs migrations then starts server

set -e

echo "🔄 Running database migrations..."

# Run Alembic migrations to create/update tables
cd /app
alembic upgrade head

echo "✅ Migrations complete"
echo "🚀 Starting backend server..."

# Start uvicorn
exec uvicorn main:app --host 0.0.0.0 --port 8001


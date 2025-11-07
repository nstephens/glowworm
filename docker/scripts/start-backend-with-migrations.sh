#!/bin/bash

# Enhanced backend startup script with robust migration handling
set -e  # Exit on any error

echo "🚀 Starting GlowWorm Backend with Migration Support..."

# Wait for MySQL to be ready using Python
echo "⏳ Waiting for MySQL to be ready..."
python3 -c "
import time
import os
import sys
from sqlalchemy import create_engine, text

mysql_host = os.getenv('MYSQL_HOST', 'glowworm-mysql')
mysql_port = int(os.getenv('MYSQL_PORT', '3306'))
mysql_user = os.getenv('MYSQL_USER', 'glowworm')
mysql_password = os.getenv('MYSQL_PASSWORD', '')
mysql_database = os.getenv('MYSQL_DATABASE', 'glowworm')

database_url = f'mysql+pymysql://{mysql_user}:{mysql_password}@{mysql_host}:{mysql_port}/{mysql_database}'

max_attempts = 30
attempt = 0

while attempt < max_attempts:
    try:
        engine = create_engine(database_url, connect_args={'connect_timeout': 5})
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        print('✅ MySQL is ready!')
        break
    except Exception as e:
        attempt += 1
        print(f'⏳ Waiting for MySQL... (attempt {attempt}/{max_attempts})')
        if attempt >= max_attempts:
            print(f'❌ Failed to connect to MySQL after {max_attempts} attempts: {e}')
            sys.exit(1)
        time.sleep(2)
"

# Check if database exists, create if not
echo "🔍 Checking database existence..."
python3 -c "
import os
import sys
from sqlalchemy import create_engine, text

mysql_host = os.getenv('MYSQL_HOST', 'glowworm-mysql')
mysql_port = int(os.getenv('MYSQL_PORT', '3306'))
mysql_user = os.getenv('MYSQL_USER', 'glowworm')
mysql_password = os.getenv('MYSQL_PASSWORD', '')
mysql_database = os.getenv('MYSQL_DATABASE', 'glowworm')

# Connect to MySQL server (without database)
server_url = f'mysql+pymysql://{mysql_user}:{mysql_password}@{mysql_host}:{mysql_port}/'
try:
    engine = create_engine(server_url, connect_args={'connect_timeout': 5})
    with engine.connect() as conn:
        # Check if database exists
        result = conn.execute(text(f'SHOW DATABASES LIKE \"{mysql_database}\"'))
        if not result.fetchone():
            print(f'📦 Creating database {mysql_database}...')
            conn.execute(text(f'CREATE DATABASE IF NOT EXISTS {mysql_database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'))
            conn.commit()
            print(f'✅ Database {mysql_database} created successfully')
        else:
            print(f'✅ Database {mysql_database} already exists')
except Exception as e:
    print(f'❌ Failed to check/create database: {e}')
    sys.exit(1)
"

# Run database migrations with enhanced error handling
echo "🔄 Running database migrations..."
python3 -c "
import os
import sys
import subprocess
import time

def run_migration():
    try:
        # Set environment variables for Alembic
        env = os.environ.copy()
        
        # Run migration
        result = subprocess.run([
            'python', '-m', 'alembic', 'upgrade', 'head'
        ], capture_output=True, text=True, env=env, cwd='/app')
        
        if result.returncode == 0:
            print('✅ Database migrations completed successfully')
            if result.stdout:
                print(f'Migration output: {result.stdout}')
        else:
            print(f'❌ Migration failed with return code {result.returncode}')
            print(f'Error output: {result.stderr}')
            if result.stdout:
                print(f'Standard output: {result.stdout}')
            
            # Try to get current migration status
            print('🔍 Checking current migration status...')
            status_result = subprocess.run([
                'python', '-m', 'alembic', 'current'
            ], capture_output=True, text=True, env=env, cwd='/app')
            print(f'Current migration status: {status_result.stdout}')
            
            # Try to get migration history
            history_result = subprocess.run([
                'python', '-m', 'alembic', 'history', '--verbose'
            ], capture_output=True, text=True, env=env, cwd='/app')
            print(f'Migration history: {history_result.stdout}')
            
            sys.exit(1)
    except Exception as e:
        print(f'❌ Failed to run migrations: {e}')
        sys.exit(1)

run_migration()
"

# Verify database schema
echo "🔍 Verifying database schema..."
python3 -c "
import os
import sys
from sqlalchemy import create_engine, text, inspect

mysql_host = os.getenv('MYSQL_HOST', 'glowworm-mysql')
mysql_port = int(os.getenv('MYSQL_PORT', '3306'))
mysql_user = os.getenv('MYSQL_USER', 'glowworm')
mysql_password = os.getenv('MYSQL_PASSWORD', '')
mysql_database = os.getenv('MYSQL_DATABASE', 'glowworm')

database_url = f'mysql+pymysql://{mysql_user}:{mysql_password}@{mysql_host}:{mysql_port}/{mysql_database}'

try:
    engine = create_engine(database_url)
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    expected_tables = [
        'users', 'images', 'albums', 'playlists', 'playlist_images', 
        'displays', 'display_playlists', 'system_settings', 'alembic_version'
    ]
    
    missing_tables = [table for table in expected_tables if table not in tables]
    
    if missing_tables:
        print(f'⚠️  Missing tables: {missing_tables}')
    else:
        print('✅ All expected tables are present')
    
    print(f'📊 Found {len(tables)} tables: {tables}')
    
except Exception as e:
    print(f'❌ Failed to verify database schema: {e}')
    sys.exit(1)
"

# Auto-migrate existing images to background processing (ONE TIME ONLY)
echo ""
echo "🔍 Checking if background processing migration is needed..."
MIGRATION_FLAG="/app/.migration_background_processing_done"

if [ ! -f "$MIGRATION_FLAG" ]; then
    echo "🔄 First startup after background processing upgrade detected"
    echo "   Running one-time migration for existing images..."
    echo "   This will:"
    echo "   - Check existing images for thumbnails and variants"
    echo "   - Update processing status accordingly"
    echo "   - Only runs once (creates flag file when complete)"
    echo ""
    
    # Run migration script in background processing mode
    python scripts/migrate_to_background_processing.py --force --batch-size 200
    
    if [ $? -eq 0 ]; then
        echo "✅ Background processing migration completed successfully"
        echo "   Creating flag file to prevent future runs..."
        touch "$MIGRATION_FLAG"
        echo "   Flag created: $MIGRATION_FLAG"
    else
        echo "⚠️  Background processing migration failed"
        echo "   Will retry on next container restart"
        echo "   You can also run manually:"
        echo "   docker compose exec glowworm-backend python scripts/migrate_to_background_processing.py"
    fi
else
    echo "✅ Background processing migration already complete (flag exists)"
    echo "   If you need to re-run, delete: $MIGRATION_FLAG"
fi

echo ""

# Start the backend server
echo "🚀 Starting backend server..."
exec python -m uvicorn main:app --host 0.0.0.0 --port 8001
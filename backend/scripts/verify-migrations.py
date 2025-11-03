#!/usr/bin/env python3
"""
Migration verification script for GlowWorm
Checks database schema and migration status
"""
import sys
import os
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text, inspect
from config.settings import get_fresh_settings
from utils.logger import get_logger

logger = get_logger(__name__)

def verify_database_schema():
    """Verify that all required tables exist and have correct structure"""
    try:
        settings = get_fresh_settings()
        database_url = f"mysql+pymysql://{settings.mysql_user}:{settings.mysql_password}@{settings.mysql_host}:{settings.mysql_port}/{settings.mysql_database}"
        
        engine = create_engine(database_url)
        inspector = inspect(engine)
        
        # Get all tables
        tables = inspector.get_table_names()
        logger.info(f"Found {len(tables)} tables: {tables}")
        
        # Check for required tables
        required_tables = [
            'users', 'images', 'albums', 'playlists', 'playlist_images', 
            'displays', 'display_playlists', 'system_settings', 'alembic_version'
        ]
        
        missing_tables = [table for table in required_tables if table not in tables]
        
        if missing_tables:
            logger.error(f"Missing required tables: {missing_tables}")
            return False
        
        # Check alembic version table
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            current_version = result.fetchone()
            if current_version:
                logger.info(f"Current migration version: {current_version[0]}")
            else:
                logger.warning("No migration version found in alembic_version table")
        
        # Check system_settings table structure
        if 'system_settings' in tables:
            columns = inspector.get_columns('system_settings')
            column_names = [col['name'] for col in columns]
            logger.info(f"system_settings columns: {column_names}")
            
            # Check for required columns
            required_columns = ['id', 'key', 'value', 'setting_type', 'created_at', 'updated_at']
            missing_columns = [col for col in required_columns if col not in column_names]
            
            if missing_columns:
                logger.error(f"Missing required columns in system_settings: {missing_columns}")
                return False
        
        logger.info("✅ Database schema verification passed")
        return True
        
    except Exception as e:
        logger.error(f"❌ Database schema verification failed: {e}")
        return False

def check_migration_status():
    """Check current migration status using Alembic"""
    try:
        import subprocess
        import os
        
        # Set working directory to backend
        backend_path = Path(__file__).parent.parent
        
        # Run alembic current
        result = subprocess.run([
            'python', '-m', 'alembic', 'current'
        ], capture_output=True, text=True, cwd=str(backend_path), env=os.environ.copy())
        
        if result.returncode == 0:
            logger.info(f"Current migration: {result.stdout.strip()}")
            return True
        else:
            logger.error(f"Failed to get migration status: {result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"Failed to check migration status: {e}")
        return False

def main():
    """Main verification function"""
    logger.info("🔍 Starting database migration verification...")
    
    # Check migration status
    if not check_migration_status():
        logger.error("❌ Migration status check failed")
        sys.exit(1)
    
    # Verify database schema
    if not verify_database_schema():
        logger.error("❌ Database schema verification failed")
        sys.exit(1)
    
    logger.info("✅ All migration checks passed!")
    return True

if __name__ == "__main__":
    main()


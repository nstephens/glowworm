#!/usr/bin/env python3
"""
GlowWorm Reset to Defaults Script

This script resets the GlowWorm application to factory defaults for fresh development.
It handles database reset, settings reset, and upload cleanup while preserving
database credentials for convenience.

Usage:
    python scripts/glowworm_reset_to_defaults.py [--yes]
    
Options:
    --yes    Skip confirmation prompt (useful for automation)
"""

import os
import sys
import json
import shutil
import argparse
import subprocess
from pathlib import Path

# Define project root
PROJECT_ROOT = Path(__file__).parent.parent
BACKEND_DIR = PROJECT_ROOT / 'backend'
UPLOADS_DIR = PROJECT_ROOT / 'uploads'
VENV_PYTHON = BACKEND_DIR / 'venv' / 'bin' / 'python'

# Check if we're running in venv, if not, re-execute with venv python
if not hasattr(sys, 'real_prefix') and not (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
    # Not in venv, check if venv exists
    if VENV_PYTHON.exists():
        print(f"🔄 Re-executing with virtual environment: {VENV_PYTHON}")
        print()
        # Re-execute this script with venv python
        os.execv(str(VENV_PYTHON), [str(VENV_PYTHON)] + sys.argv)
    else:
        print("❌ Virtual environment not found.")
        print(f"Expected: {VENV_PYTHON}")
        print()
        print("Please run ./setup.sh first to create the virtual environment.")
        sys.exit(1)

# Now we're in venv, import pymysql
import pymysql


def confirm_reset(skip_confirm=False):
    """Ask user to confirm the reset operation"""
    print("\n🔄 GlowWorm Reset to Defaults")
    print("=" * 60)
    print()
    print("⚠️  WARNING: This will:")
    print("  ✗ Drop and recreate all database tables (ALL DATA LOST)")
    print("  ✗ Reset application settings to defaults")
    print("  ✗ Clear all uploaded images and thumbnails")
    print("  ✗ Trigger the setup wizard on next start")
    print()
    print("✓ Preserve: Database credentials, server URLs, secret keys")
    print()
    
    if skip_confirm:
        print("⚡ Auto-confirmed with --yes flag")
        return True
    
    response = input("Are you sure you want to continue? (type 'yes' to confirm): ")
    return response.lower() == 'yes'


def load_current_settings():
    """Load current settings to preserve credentials"""
    settings_file = BACKEND_DIR / 'config' / 'settings.json'
    
    try:
        with open(settings_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️  Could not load current settings: {e}")
        return {}


def reset_database(current_settings):
    """Drop and recreate database"""
    print("\n🗄️  Step 1: Resetting database...")
    
    try:
        db_name = current_settings.get('mysql_database', 'glowworm')
        db_host = current_settings.get('mysql_host', 'localhost')
        db_port = current_settings.get('mysql_port', 3306)
        db_root_user = current_settings.get('mysql_root_user', 'root')
        db_root_password = current_settings.get('mysql_root_password', '')
        
        # If no password in settings, prompt for it
        if not db_root_password:
            import getpass
            print(f"  MySQL root password not found in settings.")
            db_root_password = getpass.getpass(f"  Please enter MySQL root password for '{db_root_user}' (or press Enter if none): ")
        
        # Connect to MySQL server (not database)
        print(f"  Connecting to MySQL at {db_host}:{db_port} as {db_root_user}...")
        connection = pymysql.connect(
            host=db_host,
            port=db_port,
            user=db_root_user,
            password=db_root_password,
        )
        
        with connection.cursor() as cursor:
            # Drop database if exists
            print(f"  Dropping database '{db_name}' if exists...")
            cursor.execute(f"DROP DATABASE IF EXISTS `{db_name}`")
            
            # Create fresh database
            print(f"  Creating fresh database '{db_name}'...")
            cursor.execute(
                f"CREATE DATABASE `{db_name}` "
                f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
            
        connection.close()
        print("  ✅ Database reset complete")
        return True
        
    except Exception as e:
        print(f"  ❌ Failed to reset database: {e}")
        print()
        print("  💡 Troubleshooting:")
        print("    - Ensure MySQL is running: sudo systemctl status mysql")
        print("    - Check credentials in backend/config/settings.json")
        print("    - Verify root user has CREATE/DROP privileges")
        return False


def run_migrations():
    """Run alembic migrations to create tables"""
    print("\n🔄 Step 2: Running database migrations...")
    
    try:
        # Change to backend directory for alembic
        os.chdir(BACKEND_DIR)
        
        print("  Running alembic upgrade head...")
        result = os.system("alembic upgrade head")
        
        if result == 0:
            print("  ✅ Database tables created successfully")
            return True
        else:
            print("  ❌ Migration failed with exit code:", result)
            return False
            
    except Exception as e:
        print(f"  ❌ Failed to run migrations: {e}")
        return False
    finally:
        # Return to project root
        os.chdir(PROJECT_ROOT)


def clear_uploads():
    """Clear the uploads directory"""
    print("\n📁 Step 3: Clearing uploads directory...")
    
    try:
        if UPLOADS_DIR.exists():
            # Count files before deletion
            file_count = sum(1 for _ in UPLOADS_DIR.rglob('*') if _.is_file())
            
            if file_count > 0:
                print(f"  Removing {file_count} files...")
                # Remove all files and subdirectories
                for item in UPLOADS_DIR.iterdir():
                    if item.is_file():
                        item.unlink()
                    elif item.is_dir():
                        shutil.rmtree(item)
            else:
                print("  Directory already empty")
        else:
            print("  Creating uploads directory...")
            UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        
        print("  ✅ Uploads cleared")
        return True
        
    except Exception as e:
        print(f"  ❌ Failed to clear uploads: {e}")
        return False


def reset_settings(current_settings):
    """Reset settings while preserving database credentials"""
    print("\n⚙️  Step 4: Resetting application settings...")
    
    try:
        config_dir = BACKEND_DIR / 'config'
        settings_file = config_dir / 'settings.json'
        example_file = config_dir / 'settings.json.example'
        
        # Load example settings
        with open(example_file, 'r') as f:
            new_settings = json.load(f)
        
        # Preserve critical credentials from current settings
        preserve_keys = [
            'mysql_host', 'mysql_port', 'mysql_root_user', 'mysql_root_password',
            'app_db_user', 'app_db_password', 'mysql_database', 'secret_key',
            'server_base_url', 'backend_port', 'frontend_port'
        ]
        
        print("  Preserving database credentials and server settings...")
        for key in preserve_keys:
            if key in current_settings and current_settings[key]:
                new_settings[key] = current_settings[key]
        
        # Reset admin and setup flags
        new_settings['admin_password'] = ''
        new_settings['setup_completed'] = False
        
        # Save updated settings
        with open(settings_file, 'w') as f:
            json.dump(new_settings, f, indent=2)
        
        print("  ✅ Settings reset (credentials preserved)")
        return True
        
    except Exception as e:
        print(f"  ❌ Failed to reset settings: {e}")
        return False


def print_summary():
    """Print summary and next steps"""
    print("\n" + "=" * 60)
    print("✅ GlowWorm Reset to Defaults Complete!")
    print("=" * 60)
    print()
    print("🚀 Next Steps:")
    print()
    print("  1. Start the backend server:")
    print("     cd backend")
    print("     source venv/bin/activate")
    print("     uvicorn main:app --reload --port 8001")
    print()
    print("  2. Start the frontend (in a new terminal):")
    print("     cd frontend")
    print("     npm run dev")
    print()
    print("  3. Open your browser:")
    print("     http://localhost:3003")
    print()
    print("  4. Complete the setup wizard:")
    print("     - Create admin user account")
    print("     - Configure initial settings")
    print()
    print("💡 Quick start: ./start_glowworm.sh")
    print()


def main():
    """Main reset function"""
    # Parse arguments
    parser = argparse.ArgumentParser(description='Reset GlowWorm to factory defaults')
    parser.add_argument('--yes', '-y', action='store_true', help='Skip confirmation prompt')
    parser.add_argument('--mysql-password', '--password', '-p', help='MySQL root password (if not in settings.json)')
    args = parser.parse_args()
    
    # Load current settings first
    current_settings = load_current_settings()
    
    # Override password if provided via command line
    if args.mysql_password:
        current_settings['mysql_root_password'] = args.mysql_password
    
    # Confirm reset
    if not confirm_reset(args.yes):
        print("\n❌ Reset cancelled by user")
        sys.exit(0)
    
    print("\n🚀 Starting reset process...")
    
    # Execute reset steps in order
    steps_completed = []
    
    # Step 1: Clear uploads (do this first, safest operation)
    if clear_uploads():
        steps_completed.append("uploads")
    else:
        print("\n⚠️  Warning: Could not clear uploads, but continuing...")
    
    # Step 2: Reset database (most critical step)
    if not reset_database(current_settings):
        print("\n❌ Database reset failed. Cannot continue.")
        print()
        print("Please ensure:")
        print("  - MySQL is running")
        print("  - Database credentials in backend/config/settings.json are correct")
        print("  - Root user has CREATE/DROP DATABASE privileges")
        sys.exit(1)
    steps_completed.append("database")
    
    # Step 3: Run migrations (create tables)
    if not run_migrations():
        print("\n❌ Migration failed. Database exists but tables were not created.")
        print()
        print("You may need to:")
        print("  - Check alembic configuration")
        print("  - Verify database connection settings")
        print("  - Run: cd backend && alembic upgrade head")
        sys.exit(1)
    steps_completed.append("migrations")
    
    # Step 4: Reset settings (do this last to preserve credentials until the end)
    if reset_settings(current_settings):
        steps_completed.append("settings")
    else:
        print("\n⚠️  Warning: Settings reset failed, but database is ready")
    
    # Print summary
    print_summary()
    
    print(f"📊 Completed steps: {', '.join(steps_completed)}")
    print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Reset interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)


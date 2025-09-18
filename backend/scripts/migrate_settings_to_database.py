#!/usr/bin/env python3
"""
Migration script to move settings from file-based configuration to database
"""
import sys
import os
import json
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.system_settings import SystemSettings, SettingType
from services.database_config_service import DatabaseConfigService
from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)


def migrate_settings():
    """Migrate settings from file to database"""
    try:
        # Create database connection
        database_url = f"mysql+pymysql://{settings.mysql_user}:{settings.mysql_password}@{settings.mysql_host}:{settings.mysql_port}/{settings.mysql_database}"
        engine = create_engine(database_url)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        with SessionLocal() as db:
            config_service = DatabaseConfigService(db)
            
            # Check if system_settings table exists
            result = db.execute("SHOW TABLES LIKE 'system_settings'")
            if not result.fetchone():
                print("❌ system_settings table does not exist. Please run database migration first.")
                return False
            
            # Load existing settings from files
            file_settings = {}
            
            # Load from backend/config/settings.json
            backend_settings_file = backend_dir / "config" / "settings.json"
            if backend_settings_file.exists():
                try:
                    with open(backend_settings_file, 'r') as f:
                        backend_settings = json.load(f)
                        file_settings.update(backend_settings)
                        print(f"✅ Loaded settings from {backend_settings_file}")
                except Exception as e:
                    print(f"⚠️  Could not load {backend_settings_file}: {e}")
            
            # Load from root config/settings.json
            root_settings_file = backend_dir.parent / "config" / "settings.json"
            if root_settings_file.exists():
                try:
                    with open(root_settings_file, 'r') as f:
                        root_settings = json.load(f)
                        file_settings.update(root_settings)
                        print(f"✅ Loaded settings from {root_settings_file}")
                except Exception as e:
                    print(f"⚠️  Could not load {root_settings_file}: {e}")
            
            if not file_settings:
                print("⚠️  No settings files found. Initializing with default settings.")
                config_service.initialize_default_settings()
                return True
            
            print(f"📋 Found {len(file_settings)} settings in files")
            
            # Settings to migrate (exclude database credentials and bootstrap settings)
            settings_to_migrate = {
                'server_base_url', 'backend_port', 'frontend_port', 
                'default_display_time_seconds', 'upload_directory',
                'display_status_check_interval', 'display_websocket_check_interval',
                'log_level', 'enable_debug_logging', 'google_client_id',
                'google_client_secret', 'target_display_sizes'
            }
            
            migrated_count = 0
            skipped_count = 0
            
            for key, value in file_settings.items():
                if key in settings_to_migrate and value is not None:
                    # Check if setting already exists in database
                    existing = db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
                    if existing:
                        print(f"⏭️  Skipping {key} (already exists in database)")
                        skipped_count += 1
                        continue
                    
                    # Determine setting type
                    if isinstance(value, bool):
                        setting_type = SettingType.BOOLEAN
                    elif isinstance(value, (int, float)):
                        setting_type = SettingType.NUMBER
                    elif isinstance(value, (list, dict)):
                        setting_type = SettingType.JSON
                    else:
                        setting_type = SettingType.STRING
                    
                    # Determine if sensitive
                    is_sensitive = key in ['google_client_id', 'google_client_secret']
                    
                    # Create setting
                    setting = SystemSettings(
                        setting_key=key,
                        setting_type=setting_type,
                        is_sensitive=is_sensitive
                    )
                    setting.set_typed_value(value)
                    
                    db.add(setting)
                    migrated_count += 1
                    print(f"✅ Migrated {key}: {value}")
            
            # Initialize any missing default settings
            default_settings = config_service.get_default_settings()
            for key, value in default_settings.items():
                existing = db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
                if not existing:
                    # Determine setting type
                    if isinstance(value, bool):
                        setting_type = SettingType.BOOLEAN
                    elif isinstance(value, (int, float)):
                        setting_type = SettingType.NUMBER
                    elif isinstance(value, (list, dict)):
                        setting_type = SettingType.JSON
                    else:
                        setting_type = SettingType.STRING
                    
                    # Determine if sensitive
                    is_sensitive = key in ['google_client_id', 'google_client_secret']
                    
                    # Create setting
                    setting = SystemSettings(
                        setting_key=key,
                        setting_type=setting_type,
                        is_sensitive=is_sensitive
                    )
                    setting.set_typed_value(value)
                    
                    db.add(setting)
                    print(f"✅ Added default setting {key}: {value}")
            
            db.commit()
            
            print(f"\n🎉 Migration completed successfully!")
            print(f"   • Migrated: {migrated_count} settings")
            print(f"   • Skipped: {skipped_count} settings (already existed)")
            print(f"   • Added: {len(default_settings) - migrated_count} default settings")
            
            # Show final settings count
            total_settings = db.query(SystemSettings).count()
            print(f"   • Total settings in database: {total_settings}")
            
            return True
            
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        print(f"❌ Migration failed: {e}")
        return False


def cleanup_file_settings():
    """Remove migrated settings from files (optional cleanup)"""
    try:
        # Settings to remove from files (keep only bootstrap settings)
        settings_to_remove = {
            'server_base_url', 'backend_port', 'frontend_port', 
            'default_display_time_seconds', 'upload_directory',
            'display_status_check_interval', 'display_websocket_check_interval',
            'log_level', 'enable_debug_logging', 'google_client_id',
            'google_client_secret', 'target_display_sizes'
        }
        
        # Bootstrap settings to keep
        bootstrap_settings = {
            'mysql_host', 'mysql_port', 'mysql_root_user', 'mysql_root_password',
            'app_db_user', 'app_db_password', 'secret_key'
        }
        
        cleaned_files = 0
        
        # Clean backend/config/settings.json
        backend_settings_file = backend_dir / "config" / "settings.json"
        if backend_settings_file.exists():
            with open(backend_settings_file, 'r') as f:
                settings = json.load(f)
            
            # Keep only bootstrap settings
            cleaned_settings = {k: v for k, v in settings.items() if k in bootstrap_settings}
            
            with open(backend_settings_file, 'w') as f:
                json.dump(cleaned_settings, f, indent=2)
            
            removed_count = len(settings) - len(cleaned_settings)
            if removed_count > 0:
                print(f"🧹 Cleaned {backend_settings_file}: removed {removed_count} migrated settings")
                cleaned_files += 1
        
        # Clean root config/settings.json
        root_settings_file = backend_dir.parent / "config" / "settings.json"
        if root_settings_file.exists():
            with open(root_settings_file, 'r') as f:
                settings = json.load(f)
            
            # Keep only bootstrap settings
            cleaned_settings = {k: v for k, v in settings.items() if k in bootstrap_settings}
            
            with open(root_settings_file, 'w') as f:
                json.dump(cleaned_settings, f, indent=2)
            
            removed_count = len(settings) - len(cleaned_settings)
            if removed_count > 0:
                print(f"🧹 Cleaned {root_settings_file}: removed {removed_count} migrated settings")
                cleaned_files += 1
        
        if cleaned_files > 0:
            print(f"✅ Cleaned {cleaned_files} settings files")
        else:
            print("ℹ️  No settings files needed cleaning")
            
    except Exception as e:
        print(f"⚠️  Cleanup failed: {e}")


def main():
    """Main migration function"""
    print("🚀 Starting settings migration to database...")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not (backend_dir / "models").exists():
        print("❌ Please run this script from the backend directory")
        sys.exit(1)
    
    # Run migration
    success = migrate_settings()
    
    if success:
        print("\n" + "=" * 50)
        print("🎯 Migration completed successfully!")
        print("\nNext steps:")
        print("1. Test the application to ensure settings work correctly")
        print("2. Run cleanup to remove migrated settings from files (optional)")
        print("3. Update your deployment process to use the new configuration system")
        
        # Ask if user wants to clean up files
        try:
            response = input("\nWould you like to clean up migrated settings from files? (y/N): ")
            if response.lower() in ['y', 'yes']:
                cleanup_file_settings()
        except KeyboardInterrupt:
            print("\n⚠️  Cleanup skipped")
    else:
        print("\n❌ Migration failed. Please check the error messages above.")
        sys.exit(1)


if __name__ == "__main__":
    main()

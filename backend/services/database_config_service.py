"""
Database Configuration Service
Manages system settings stored in the database
"""
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from models.system_settings import SystemSettings, SettingType
from utils.logger import get_logger

logger = get_logger(__name__)


class DatabaseConfigService:
    """Service for managing system configuration stored in database"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_setting(self, key: str, default: Any = None) -> Any:
        """Get a single setting value by key"""
        try:
            setting = self.db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
            if setting:
                return setting.get_typed_value()
            return default
        except SQLAlchemyError as e:
            logger.error(f"Error getting setting '{key}': {e}")
            return default
    
    def get_settings(self, keys: Optional[List[str]] = None, include_sensitive: bool = False) -> Dict[str, Any]:
        """Get multiple settings as a dictionary"""
        try:
            query = self.db.query(SystemSettings)
            
            if keys:
                query = query.filter(SystemSettings.setting_key.in_(keys))
            
            if not include_sensitive:
                query = query.filter(SystemSettings.is_sensitive == False)
            
            settings = query.all()
            return {setting.setting_key: setting.get_typed_value() for setting in settings}
        except SQLAlchemyError as e:
            logger.error(f"Error getting settings: {e}")
            return {}
    
    def set_setting(self, key: str, value: Any, setting_type: SettingType = SettingType.STRING, 
                   description: str = None, is_sensitive: bool = False) -> bool:
        """Set a single setting value"""
        try:
            setting = self.db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
            
            if setting:
                # Update existing setting
                setting.set_typed_value(value)
                if description:
                    setting.description = description
                setting.is_sensitive = is_sensitive
            else:
                # Create new setting
                setting = SystemSettings(
                    setting_key=key,
                    setting_type=setting_type,
                    description=description,
                    is_sensitive=is_sensitive
                )
                setting.set_typed_value(value)
                self.db.add(setting)
            
            self.db.commit()
            logger.debug(f"Setting '{key}' updated successfully")
            return True
            
        except SQLAlchemyError as e:
            logger.error(f"Error setting '{key}': {e}")
            self.db.rollback()
            return False
    
    def set_settings(self, settings: Dict[str, Any]) -> bool:
        """Set multiple settings at once"""
        try:
            for key, value in settings.items():
                setting = self.db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
                
                if setting:
                    setting.set_typed_value(value)
                else:
                    # Create new setting with default type and description
                    setting = SystemSettings(setting_key=key)
                    setting.set_typed_value(value)
                    self.db.add(setting)
            
            self.db.commit()
            logger.debug(f"Updated {len(settings)} settings successfully")
            return True
            
        except SQLAlchemyError as e:
            logger.error(f"Error setting multiple settings: {e}")
            self.db.rollback()
            return False
    
    def delete_setting(self, key: str) -> bool:
        """Delete a setting"""
        try:
            setting = self.db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
            if setting:
                self.db.delete(setting)
                self.db.commit()
                logger.debug(f"Setting '{key}' deleted successfully")
                return True
            return False
        except SQLAlchemyError as e:
            logger.error(f"Error deleting setting '{key}': {e}")
            self.db.rollback()
            return False
    
    def get_all_settings(self, include_sensitive: bool = False) -> List[Dict[str, Any]]:
        """Get all settings as a list of dictionaries"""
        try:
            query = self.db.query(SystemSettings)
            
            if not include_sensitive:
                query = query.filter(SystemSettings.is_sensitive == False)
            
            settings = query.all()
            return [setting.to_dict() for setting in settings]
        except SQLAlchemyError as e:
            logger.error(f"Error getting all settings: {e}")
            return []
    
    def get_default_settings(self) -> Dict[str, Any]:
        """Get default application settings"""
        return {
            "server_base_url": "http://localhost:8001",
            "backend_port": 8001,
            "frontend_port": 3003,
            "default_display_time_seconds": 30,
            "upload_directory": "uploads",
            "display_status_check_interval": 30,
            "display_websocket_check_interval": 5,
            "log_level": "INFO",
            "enable_debug_logging": False,
            "google_client_id": "",
            "google_client_secret": "",
            "target_display_sizes": ["1080x1920", "2k-portrait", "4k-portrait"]
        }
    
    def initialize_default_settings(self) -> bool:
        """Initialize database with default settings if they don't exist"""
        try:
            default_settings = self.get_default_settings()
            
            for key, value in default_settings.items():
                # Check if setting already exists
                existing = self.db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
                if not existing:
                    # Determine setting type based on value
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
                    self.db.add(setting)
            
            self.db.commit()
            logger.info("Default settings initialized successfully")
            return True
            
        except SQLAlchemyError as e:
            logger.error(f"Error initializing default settings: {e}")
            self.db.rollback()
            return False
    
    def migrate_from_file_settings(self, file_settings: Dict[str, Any]) -> bool:
        """Migrate settings from file-based configuration to database"""
        try:
            # Settings to migrate (exclude database credentials and sensitive bootstrap settings)
            settings_to_migrate = {
                'server_base_url', 'backend_port', 'frontend_port', 
                'default_display_time_seconds', 'upload_directory',
                'display_status_check_interval', 'display_websocket_check_interval',
                'log_level', 'enable_debug_logging', 'google_client_id',
                'google_client_secret', 'target_display_sizes'
            }
            
            migrated_count = 0
            for key, value in file_settings.items():
                if key in settings_to_migrate and value is not None:
                    success = self.set_setting(key, value)
                    if success:
                        migrated_count += 1
            
            logger.info(f"Migrated {migrated_count} settings from file to database")
            return True
            
        except Exception as e:
            logger.error(f"Error migrating settings from file: {e}")
            return False

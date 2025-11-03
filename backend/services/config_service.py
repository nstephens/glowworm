"""
Configuration Service
Provides access to both bootstrap (file) and application (database) settings
"""
from typing import Any, Optional
from sqlalchemy.orm import Session
from models.database import SessionLocal
from services.database_config_service import DatabaseConfigService
from config.settings import settings as bootstrap_settings
from utils.logger import get_logger

logger = get_logger(__name__)


class ConfigService:
    """Service for accessing configuration from both file and database"""
    
    def __init__(self, db: Optional[Session] = None):
        self.db = db
        self._database_config_service = None
    
    def _get_database_config_service(self) -> Optional[DatabaseConfigService]:
        """Get database config service, creating session if needed"""
        # Check if setup is complete before attempting database access
        from config.settings import is_configured
        if not is_configured():
            logger.debug("Skipping database config service - setup not complete")
            return None
            
        if self.db:
            # Use the provided session (from API endpoints)
            return DatabaseConfigService(self.db)
        else:
            # Create a new session for this operation
            try:
                # Ensure database is initialized before creating session
                from models.database import ensure_database_initialized
                ensure_database_initialized()
                
                db = SessionLocal()
                try:
                    return DatabaseConfigService(db)
                finally:
                    # Always close the session after use
                    db.close()
            except Exception as e:
                logger.debug(f"Could not create database config service: {e}")
                return None
    
    def get_setting(self, key: str, default: Any = None) -> Any:
        """Get a setting value from database first, then file, then default"""
        # Try database first
        # Check if setup is complete before attempting database access
        from config.settings import is_configured
        if not is_configured():
            logger.debug("Skipping database config - setup not complete")
            # Fall back to bootstrap settings
            try:
                return getattr(bootstrap_settings, key, default)
            except AttributeError:
                return default
        
        # Create a fresh session for this query
        db = None
        try:
            from models.database import SessionLocal, ensure_database_initialized
            ensure_database_initialized()
            
            db = SessionLocal()
            db_config = DatabaseConfigService(db)
            value = db_config.get_setting(key)
            if value is not None:
                return value
        except Exception as e:
            logger.debug(f"Could not get setting '{key}' from database: {e}")
            if db:
                try:
                    db.rollback()
                except:
                    pass
        finally:
            if db:
                db.close()
        
        # Fall back to bootstrap settings
        try:
            return getattr(bootstrap_settings, key, default)
        except AttributeError:
            return default
    
    def get_settings(self, keys: Optional[list] = None) -> dict:
        """Get multiple settings"""
        result = {}
        
        # Get from database first
        db_config = self._get_database_config_service()
        if db_config:
            try:
                db_settings = db_config.get_settings(keys, include_sensitive=True)
                result.update(db_settings)
            except Exception as e:
                logger.debug(f"Could not get settings from database: {e}")
                # If we created our own session and it failed, we need to rollback and close it
                if not self.db:
                    try:
                        db_config.db.rollback()
                    except:
                        pass
        
        # Fill in missing values from bootstrap settings
        if keys:
            for key in keys:
                if key not in result:
                    try:
                        value = getattr(bootstrap_settings, key, None)
                        if value is not None:
                            result[key] = value
                    except AttributeError:
                        pass
        else:
            # Add all bootstrap settings that aren't already in result
            for attr_name in dir(bootstrap_settings):
                if not attr_name.startswith('_') and attr_name not in result:
                    try:
                        value = getattr(bootstrap_settings, attr_name)
                        if not callable(value):
                            result[attr_name] = value
                    except AttributeError:
                        pass
        
        return result
    
    # Convenience methods for commonly used settings
    @property
    def server_base_url(self) -> str:
        return self.get_setting('server_base_url', 'http://localhost:8001')
    
    @property
    def backend_port(self) -> int:
        return self.get_setting('backend_port', 8001)
    
    @property
    def frontend_port(self) -> int:
        return self.get_setting('frontend_port', 3003)
    
    @property
    def default_display_time_seconds(self) -> int:
        return self.get_setting('default_display_time_seconds', 30)
    
    @property
    def upload_directory(self) -> str:
        return self.get_setting('upload_directory', 'uploads')
    
    @property
    def display_status_check_interval(self) -> int:
        return self.get_setting('display_status_check_interval', 30)
    
    @property
    def display_websocket_check_interval(self) -> int:
        return self.get_setting('display_websocket_check_interval', 5)
    
    @property
    def log_level(self) -> str:
        return self.get_setting('log_level', 'INFO')
    
    
    @property
    def google_client_id(self) -> str:
        return self.get_setting('google_client_id', '')
    
    @property
    def google_client_secret(self) -> str:
        return self.get_setting('google_client_secret', '')
    
    @property
    def target_display_sizes(self) -> list:
        # Don't use a default - empty list is valid (means no sizes configured)
        value = self.get_setting('target_display_sizes', None)
        if value is None:
            # Only use default if setting doesn't exist at all
            return ['1080x1920', '2k-portrait', '4k-portrait']
        return value if isinstance(value, list) else []


# Global configuration service instance
config_service = ConfigService()

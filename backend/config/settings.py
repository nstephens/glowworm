from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
import os
import json
from pathlib import Path
from sqlalchemy import create_engine, text

class Settings(BaseSettings):
    # Database settings (automatically read from env vars by Pydantic)
    mysql_host: str = Field(default="localhost", description="MySQL host", env="MYSQL_HOST")
    mysql_port: int = Field(default=3306, description="MySQL port", env="MYSQL_PORT")
    app_db_user: str = Field(default="glowworm", description="Application database username", env="MYSQL_USER")
    app_db_password: str = Field(default="", description="Application database password", env="MYSQL_PASSWORD")
    mysql_database: str = Field(default="glowworm", description="MySQL database name", env="MYSQL_DATABASE")
    
    # Legacy field mapping for backward compatibility
    @property
    def mysql_user(self) -> str:
        return self.app_db_user
    
    @property
    def mysql_password(self) -> str:
        return self.app_db_password
    
    # Application settings
    app_name: str = Field(default="GlowWorm", description="Application name")
    app_version: str = Field(default="0.1.0", description="Application version")
    secret_key: str = Field(default="", description="Secret key for encryption", env="SECRET_KEY")
    server_base_url: str = Field(default="http://localhost:8001", description="Base URL for the server (used for API endpoints and image URLs)", env="SERVER_BASE_URL")
    
    # Server configuration
    backend_port: int = Field(default=8001, description="Backend server port")
    frontend_port: int = Field(default=3003, description="Frontend development server port")
    
    # Display configuration
    default_display_time_seconds: int = Field(default=30, description="Default time to display each image in seconds")
    
    # File storage configuration
    upload_directory: str = Field(default="uploads", description="Directory for uploaded files")
    
    # Status check intervals (in seconds)
    display_status_check_interval: int = Field(default=30, description="Interval for checking display device status")
    display_websocket_check_interval: int = Field(default=5, description="Interval for WebSocket display status checks")
    
    # Logging configuration
    log_level: str = Field(default="INFO", description="Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)")
    
    # OAuth settings
    google_client_id: Optional[str] = Field(default=None, description="Google OAuth client ID")
    google_client_secret: Optional[str] = Field(default=None, description="Google OAuth client secret")
    
    # Security settings
    cookie_max_age: int = Field(default=86400 * 30, description="Cookie max age in seconds (30 days)")
    cookie_secure: bool = Field(default=False, description="Secure cookie flag")
    cookie_httponly: bool = Field(default=True, description="HttpOnly cookie flag")
    
    # File upload settings
    max_file_size: int = Field(default=15 * 1024 * 1024, description="Max file size in bytes (15MB)")
    upload_path: str = Field(default="../uploads", description="Upload directory path", env="UPLOAD_PATH")
    
    # Display settings
    default_slideshow_duration: int = Field(default=5, description="Default slideshow duration in seconds")
    
    # Setup status
    setup_completed: bool = Field(default=False, description="Whether setup has been completed")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"  # Ignore extra fields in .env file

# Global settings instance
settings = Settings()

def get_fresh_settings() -> Settings:
    """Get a fresh Settings instance with current configuration from file"""
    try:
        config_file = get_config_file_path()
        if config_file.exists():
            with open(config_file, 'r') as f:
                config_data = json.load(f)
            
            # Create a new Settings instance with the file data
            return Settings(**config_data)
        else:
            return Settings()
    except Exception:
        return Settings()

def is_configured() -> bool:
    """Check if the application is properly configured"""
    # For Docker deployments, check if we have environment variables set
    if os.getenv('MYSQL_PASSWORD') and os.getenv('SECRET_KEY'):
        # Running in Docker with environment variables - test database connection
        try:
            mysql_host = os.getenv('MYSQL_HOST', 'localhost')
            mysql_port = int(os.getenv('MYSQL_PORT', '3306'))
            mysql_user = os.getenv('MYSQL_USER', 'glowworm')
            mysql_password = os.getenv('MYSQL_PASSWORD', '')
            mysql_database = os.getenv('MYSQL_DATABASE', 'glowworm')
            
            database_url = f"mysql+pymysql://{mysql_user}:{mysql_password}@{mysql_host}:{mysql_port}/{mysql_database}"
            engine = create_engine(database_url, connect_args={"connect_timeout": 5})
            
            # Test the connection
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            
            return True
        except Exception:
            return False
    
    # Check file-based configuration (non-Docker deployments)
    try:
        config_file = get_config_file_path()
        if config_file.exists():
            with open(config_file, 'r') as f:
                config_data = json.load(f)
            
            # Check if basic configuration values exist
            if not (config_data.get('app_db_password', '') != '' and config_data.get('secret_key', '') != ''):
                return False
            
            # Then check if database is actually accessible
            database_url = f"mysql+pymysql://{config_data.get('app_db_user', 'glowworm')}:{config_data.get('app_db_password', '')}@{config_data.get('mysql_host', 'localhost')}:{config_data.get('mysql_port', 3306)}/{config_data.get('mysql_database', 'glowworm')}"
            engine = create_engine(database_url, connect_args={"connect_timeout": 5})
            
            # Test the connection
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            
            return True
        else:
            return False
    except Exception:
        # If database connection fails, consider it not configured
        return False

def get_config_file_path() -> Path:
    """Get the path to the configuration file"""
    return Path("config/settings.json")

def save_config(config_data: dict) -> bool:
    """Save configuration to settings.json file"""
    try:
        config_file = get_config_file_path()
        print(f"Saving config to: {config_file}")
        print(f"Config data: {config_data}")
        
        # Read existing config if it exists
        existing_config = {}
        if config_file.exists():
            with open(config_file, 'r') as f:
                existing_config = json.load(f)
            print(f"Existing config: {existing_config}")
        
        # Update with new values
        existing_config.update(config_data)
        print(f"Updated config: {existing_config}")
        
        # Write back to file
        with open(config_file, 'w') as f:
            json.dump(existing_config, f, indent=2)
        
        print("Config saved successfully")
        return True
    except Exception as e:
        print(f"Error saving configuration: {e}")
        return False

    # Enhanced security settings
    cookie_samesite: str = Field(default="lax", description="SameSite cookie attribute")
    session_rotation_enabled: bool = Field(default=True, description="Enable automatic session rotation")
    csrf_protection_enabled: bool = Field(default=True, description="Enable CSRF protection")
    max_login_attempts: int = Field(default=5, description="Maximum login attempts before lockout")
    lockout_duration: int = Field(default=900, description="Account lockout duration in seconds (15 minutes)")
    require_https: bool = Field(default=False, description="Require HTTPS in production")

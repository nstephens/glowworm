from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
import json
import os
from models import get_db, User
from utils.middleware import require_auth
from services.database_config_service import DatabaseConfigService

router = APIRouter(prefix="/api", tags=["settings"])

# Settings file path (for bootstrap settings only)
SETTINGS_FILE = "config/settings.json"

@router.get("/settings")
async def get_settings(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get current system settings"""
    try:
        config_service = DatabaseConfigService(db)
        
        # Get bootstrap settings from file (database credentials, etc.)
        bootstrap_settings = load_bootstrap_settings()
        
        # Get application settings from database
        app_settings = config_service.get_settings(include_sensitive=True)
        
        # Combine settings (database settings override file settings)
        all_settings = {**bootstrap_settings, **app_settings}
        
        return {"success": True, "settings": all_settings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load settings: {str(e)}")

@router.put("/settings")
async def update_settings(
    settings: Dict[str, Any],
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Update system settings"""
    try:
        config_service = DatabaseConfigService(db)
        
        # Separate bootstrap settings (file) from application settings (database)
        bootstrap_keys = {
            'mysql_host', 'mysql_port', 'mysql_root_user', 'mysql_root_password',
            'app_db_user', 'app_db_password', 'secret_key'
        }
        
        bootstrap_settings = {k: v for k, v in settings.items() if k in bootstrap_keys}
        app_settings = {k: v for k, v in settings.items() if k not in bootstrap_keys}
        
        # Validate settings
        validate_settings(settings)
        
        # Save bootstrap settings to file
        if bootstrap_settings:
            save_bootstrap_settings(bootstrap_settings)
        
        # Save application settings to database
        if app_settings:
            success = config_service.set_settings(app_settings)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to save application settings to database")
        
        return {"success": True, "message": "Settings updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")

@router.get("/settings/display-sizes")
async def get_display_sizes(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get configured display sizes"""
    try:
        config_service = DatabaseConfigService(db)
        display_sizes = config_service.get_setting("target_display_sizes", [])
        return {"success": True, "display_sizes": display_sizes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load display sizes: {str(e)}")

@router.put("/settings/display-sizes")
async def update_display_sizes(
    display_sizes: List[str],
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Update display sizes configuration"""
    try:
        config_service = DatabaseConfigService(db)
        success = config_service.set_setting("target_display_sizes", display_sizes)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update display sizes in database")
        
        return {"success": True, "message": "Display sizes updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update display sizes: {str(e)}")

def load_bootstrap_settings() -> Dict[str, Any]:
    """Load bootstrap settings from file (database credentials, etc.)"""
    if not os.path.exists(SETTINGS_FILE):
        # Return default bootstrap settings if file doesn't exist
        return get_default_bootstrap_settings()
    
    try:
        with open(SETTINGS_FILE, 'r') as f:
            all_settings = json.load(f)
            # Return only bootstrap settings
            bootstrap_keys = {
                'mysql_host', 'mysql_port', 'mysql_root_user', 'mysql_root_password',
                'app_db_user', 'app_db_password', 'secret_key'
            }
            return {k: v for k, v in all_settings.items() if k in bootstrap_keys}
    except Exception as e:
        # If file is corrupted, return defaults
        return get_default_bootstrap_settings()

def save_bootstrap_settings(settings: Dict[str, Any]) -> None:
    """Save bootstrap settings to file"""
    # Ensure config directory exists
    os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
    
    # Load existing settings and update only bootstrap settings
    existing_settings = {}
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, 'r') as f:
                existing_settings = json.load(f)
        except Exception:
            pass  # If file is corrupted, start fresh
    
    # Update only bootstrap settings
    existing_settings.update(settings)
    
    with open(SETTINGS_FILE, 'w') as f:
        json.dump(existing_settings, f, indent=2)

def get_default_bootstrap_settings() -> Dict[str, Any]:
    """Get default bootstrap settings (database credentials, etc.)"""
    return {
        "mysql_host": "localhost",
        "mysql_port": 3306,
        "mysql_root_user": "root",
        "mysql_root_password": "",
        "app_db_user": "glowworm",
        "app_db_password": "",
        "secret_key": ""
    }

def load_settings() -> Dict[str, Any]:
    """Load all settings (backward compatibility - combines bootstrap and app settings)"""
    bootstrap_settings = load_bootstrap_settings()
    # Note: This function is kept for backward compatibility
    # In the new system, application settings come from database
    return bootstrap_settings

def validate_settings(settings: Dict[str, Any]) -> None:
    """Validate settings data"""
    # Bootstrap settings validation
    bootstrap_required_fields = [
        "mysql_host", "mysql_port", "mysql_root_user", 
        "app_db_user"
    ]
    
    for field in bootstrap_required_fields:
        if field in settings and field not in ["mysql_root_password", "app_db_password"]:
            if not settings[field]:
                raise ValueError(f"Field {field} cannot be empty")
    
    # Validate port is a number
    if "mysql_port" in settings:
        if not isinstance(settings["mysql_port"], int):
            raise ValueError("MySQL port must be a number")
    
    # Validate display sizes is a list
    if "target_display_sizes" in settings:
        if not isinstance(settings["target_display_sizes"], list):
            raise ValueError("target_display_sizes must be a list")
    
    # Validate log level
    if "log_level" in settings:
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if settings["log_level"] not in valid_levels:
            raise ValueError(f"Log level must be one of: {', '.join(valid_levels)}")
    
    # Validate boolean settings
    boolean_fields = ["enable_debug_logging"]
    for field in boolean_fields:
        if field in settings:
            if not isinstance(settings[field], bool):
                raise ValueError(f"{field} must be a boolean")

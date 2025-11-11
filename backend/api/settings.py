from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from pydantic import BaseModel
import json
import os
import logging
import traceback
from models import get_db, User
from models.display_device import DisplayDevice
from utils.middleware import require_auth
from services.database_config_service import DatabaseConfigService

logger = logging.getLogger(__name__)

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
        logger.error(f"❌ Settings API Error: {str(e)}")
        logger.error(f"❌ Traceback: {traceback.format_exc()}")
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

class ResolutionSuggestion(BaseModel):
    resolution: str  # e.g., "1080x1920"
    width: int
    height: int
    device_count: int
    devices: List[str]  # Device names or tokens
    is_configured: bool

@router.get("/settings/display-sizes/suggestions")
async def get_display_size_suggestions(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get suggested display sizes based on registered devices"""
    try:
        config_service = DatabaseConfigService(db)
        configured_sizes = config_service.get_setting("target_display_sizes", [])
        
        # Parse configured sizes to width x height tuples
        configured_resolutions = set()
        for size_str in configured_sizes:
            if 'x' in size_str:
                configured_resolutions.add(size_str)
            elif size_str == "2k-portrait":
                configured_resolutions.add("1080x1920")
            elif size_str == "4k-portrait":
                configured_resolutions.add("2160x3840")
            elif size_str == "2k" or size_str == "2k-landscape":
                configured_resolutions.add("2560x1440")
            elif size_str == "4k" or size_str == "4k-landscape":
                configured_resolutions.add("3840x2160")
            elif size_str == "1080p" or size_str == "fullhd":
                configured_resolutions.add("1920x1080")
        
        # Get all devices with resolution information
        devices = db.query(DisplayDevice).filter(
            DisplayDevice.screen_width.isnot(None),
            DisplayDevice.screen_height.isnot(None)
        ).all()
        
        # Group devices by resolution
        resolution_groups = {}
        for device in devices:
            resolution = f"{device.screen_width}x{device.screen_height}"
            if resolution not in resolution_groups:
                resolution_groups[resolution] = []
            resolution_groups[resolution].append(
                device.device_name or f"Device {device.device_token[:8]}..."
            )
        
        # Create suggestions
        suggestions = []
        for resolution, device_list in resolution_groups.items():
            width, height = map(int, resolution.split('x'))
            suggestions.append(ResolutionSuggestion(
                resolution=resolution,
                width=width,
                height=height,
                device_count=len(device_list),
                devices=device_list,
                is_configured=resolution in configured_resolutions
            ))
        
        # Sort by device count (most common first), then by resolution
        suggestions.sort(key=lambda x: (-x.device_count, -x.width * x.height))
        
        return {
            "success": True,
            "suggestions": [s.dict() for s in suggestions],
            "configured_sizes": list(configured_resolutions)
        }
        
    except Exception as e:
        logger.error(f"❌ Display Size Suggestions API Error: {str(e)}")
        logger.error(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to get display size suggestions: {str(e)}")

@router.get("/settings/display-sizes/variant-status")
async def get_variant_status_by_resolution(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get variant generation status for each configured display size"""
    try:
        from pathlib import Path
        from models.image import Image
        from models.playlist import Playlist
        from models.playlist_variant import PlaylistVariant
        from services.image_storage_service import image_storage_service
        from config.settings import settings as config_settings
        
        # Get configured display sizes
        display_sizes = image_storage_service._load_display_sizes()
        
        # Get total counts
        total_images = db.query(Image).count()
        total_playlists = db.query(Playlist).count()
        
        status_by_resolution = []
        
        for width, height in display_sizes:
            resolution_str = f"{width}x{height}"
            
            # Count images with scaled variants for this resolution
            images = db.query(Image).all()
            images_with_variants = 0
            images_eligible_for_scaling = 0
            
            upload_path = Path(config_settings.upload_path)
            
            for image in images:
                # Only count images that are large enough to be scaled to this resolution
                # (matching the logic in regeneration that skips scale-ups)
                if image.width and image.height and (width > image.width or height > image.height):
                    # Image is too small for this resolution, skip
                    continue
                
                images_eligible_for_scaling += 1
                
                # Check if scaled file exists (search in both old 'scaled/' and new date-organized structure)
                if image.filename:
                    stem = Path(image.filename).stem
                    suffix = Path(image.filename).suffix
                    scaled_filename = f"{stem}_{resolution_str}{suffix}"
                    
                    # Check old flat structure first
                    scaled_path_old = upload_path / "scaled" / scaled_filename
                    if scaled_path_old.exists():
                        images_with_variants += 1
                        continue
                    
                    # Search in date-organized structure (uploads/YEAR/MONTH/user_X/)
                    found = False
                    for year_dir in upload_path.iterdir():
                        if not year_dir.is_dir() or year_dir.name in ['thumbnails', 'scaled', 'optimized']:
                            continue
                        for month_dir in year_dir.iterdir():
                            if not month_dir.is_dir():
                                continue
                            for user_dir in month_dir.iterdir():
                                if not user_dir.is_dir():
                                    continue
                                scaled_path = user_dir / scaled_filename
                                if scaled_path.exists():
                                    images_with_variants += 1
                                    found = True
                                    break
                            if found:
                                break
                            # Also check month dir directly (no user subdirectory)
                            scaled_path = month_dir / scaled_filename
                            if scaled_path.exists():
                                images_with_variants += 1
                                found = True
                                break
                        if found:
                            break
            
            # Update total to reflect only eligible images for this resolution
            total_images_for_resolution = images_eligible_for_scaling
            
            # Count playlists with variants for this resolution
            # Use subquery to count distinct playlist_ids
            from sqlalchemy import func
            playlists_with_variants = db.query(
                func.count(func.distinct(PlaylistVariant.playlist_id))
            ).filter(
                PlaylistVariant.target_width == width,
                PlaylistVariant.target_height == height
            ).scalar() or 0
            
            status_by_resolution.append({
                "resolution": resolution_str,
                "width": width,
                "height": height,
                "images_with_variants": images_with_variants,
                "total_images": total_images_for_resolution,
                "playlists_with_variants": playlists_with_variants,
                "total_playlists": total_playlists,
                "images_percentage": round((images_with_variants / total_images_for_resolution * 100) if total_images_for_resolution > 0 else 0, 1),
                "playlists_percentage": round((playlists_with_variants / total_playlists * 100) if total_playlists > 0 else 0, 1)
            })
        
        return {
            "success": True,
            "status": status_by_resolution,
            "total_images": total_images,
            "total_playlists": total_playlists
        }
        
    except Exception as e:
        logger.error(f"❌ Get variant status error: {e}")
        logger.error(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to get variant status: {str(e)}")

@router.delete("/settings/display-sizes/variants/{resolution}")
async def delete_variants_for_resolution(
    resolution: str,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Delete all variants (image files and playlist variants) for a specific resolution"""
    try:
        from pathlib import Path
        from models.image import Image
        from models.playlist_variant import PlaylistVariant
        from config.settings import settings as config_settings
        import shutil
        
        # Parse resolution (e.g., "1080x1920")
        try:
            width, height = map(int, resolution.split('x'))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid resolution format: {resolution}")
        
        deleted_counts = {
            "scaled_images": 0,
            "playlist_variants": 0,
            "failed_files": []
        }
        
        # Delete playlist variants from database
        playlist_variants = db.query(PlaylistVariant).filter(
            PlaylistVariant.target_width == width,
            PlaylistVariant.target_height == height
        ).all()
        
        deleted_counts["playlist_variants"] = len(playlist_variants)
        
        for variant in playlist_variants:
            db.delete(variant)
        
        db.commit()
        logger.info(f"🗑️ Deleted {deleted_counts['playlist_variants']} playlist variants for {resolution}")
        
        # Delete scaled image files
        upload_path = Path(config_settings.upload_path)
        scaled_dir = upload_path / "scaled"
        images = db.query(Image).all()
        
        for image in images:
            if image.filename:
                try:
                    stem = Path(image.filename).stem
                    suffix = Path(image.filename).suffix
                    scaled_filename = f"{stem}_{resolution}{suffix}"
                    scaled_path = scaled_dir / scaled_filename
                    
                    if scaled_path.exists():
                        scaled_path.unlink()
                        deleted_counts["scaled_images"] += 1
                        logger.debug(f"Deleted scaled image: {scaled_path}")
                            
                except Exception as e:
                    logger.warning(f"Failed to delete scaled image for {image.filename}: {e}")
                    deleted_counts["failed_files"].append(str(image.filename))
        
        logger.info(f"🧹 Cleanup complete for {resolution}: {deleted_counts['scaled_images']} images, {deleted_counts['playlist_variants']} playlist variants")
        
        return {
            "success": True,
            "message": f"Deleted variants for {resolution}",
            "deleted_scaled_images": deleted_counts["scaled_images"],
            "deleted_playlist_variants": deleted_counts["playlist_variants"],
            "failed_files": deleted_counts["failed_files"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Delete variants error: {e}")
        logger.error(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to delete variants: {str(e)}")

class AddResolutionRequest(BaseModel):
    resolution: str  # e.g., "1080x1920"

@router.post("/settings/display-sizes/add")
async def add_display_size(
    request: AddResolutionRequest,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Add a display size to the configuration"""
    try:
        config_service = DatabaseConfigService(db)
        current_sizes = config_service.get_setting("target_display_sizes", [])
        
        # Check if already exists
        if request.resolution in current_sizes:
            return {
                "success": True,
                "message": "Resolution already configured",
                "already_exists": True
            }
        
        # Add new resolution
        updated_sizes = current_sizes + [request.resolution]
        success = config_service.set_setting("target_display_sizes", updated_sizes)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to add display size")
        
        return {
            "success": True,
            "message": f"Added {request.resolution} to display sizes",
            "display_sizes": updated_sizes,
            "already_exists": False
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add display size: {str(e)}")

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

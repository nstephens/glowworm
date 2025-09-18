from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging
from pathlib import Path
from datetime import datetime, timedelta

from models import get_db, Image, Album, Playlist
from models.user import User
from models.display_device import DisplayDevice, DeviceStatus
from utils.middleware import require_auth
from services.image_service import ImageService
from services.image_storage_service import image_storage_service
from services.display_device_service import DisplayDeviceService
from utils.csrf import csrf_protection
from utils.cookies import CookieManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/images", tags=["images"])

@router.post("/upload")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    album_id: Optional[int] = Form(None),
    playlist_id: Optional[int] = Form(None),
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Upload and process an image"""
    try:
        # Debug CSRF token
        csrf_header = request.headers.get("X-CSRF-Token")
        csrf_cookie = request.cookies.get("glowworm_csrf")
        logger.info(f"Upload request - CSRF header: {csrf_header}, CSRF cookie: {csrf_cookie}")
        
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        # Debug request data
        logger.info(f"Upload request - album_id: {album_id}, playlist_id: {playlist_id}")
        logger.info(f"Upload request - file: {file.filename}, content_type: {file.content_type}")
        
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file selected"
            )
        
        # Read file content
        file_content = await file.read()
        
        # Process and store image
        image_metadata = image_storage_service.process_and_store_image(
            file_content, 
            file.filename,
            user_id=current_user.id
        )
        
        # Create database record
        image_service = ImageService(db)
        image = image_service.create_image(
            filename=image_metadata['filename'],
            original_filename=image_metadata['original_filename'],
            width=image_metadata['width'],
            height=image_metadata['height'],
            file_size=image_metadata['file_size'],
            mime_type=image_metadata['mime_type'],
            file_hash=image_metadata['file_hash'],
            exif_data=image_metadata['exif'],
            album_id=album_id,
            playlist_id=playlist_id
        )
        
        return {
            "message": "Image uploaded successfully",
            "data": image.to_dict(),
            "status_code": 200
        }
        
    except ValueError as e:
        logger.error(f"Image upload validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Image upload error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Image upload failed"
        )

# Request model for duplicate check
class DuplicateCheckRequest(BaseModel):
    file_hash: str

@router.post("/check-duplicate")
async def check_duplicate_image(
    request_data: DuplicateCheckRequest,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Check if an image with the given hash already exists"""
    try:
        image_service = ImageService(db)
        existing_image = image_service.get_image_by_hash(request_data.file_hash)
        
        if existing_image:
            return {
                "is_duplicate": True,
                "existing_image": existing_image.to_dict(),
                "message": "Image already exists"
            }
        else:
            return {
                "is_duplicate": False,
                "message": "Image is unique"
            }
            
    except Exception as e:
        logger.error(f"Duplicate check error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Duplicate check failed"
        )

# Public endpoint for display devices (must be before / route)
@router.get("/public")
async def get_images_public(
    request: Request,
    album_id: Optional[int] = None,
    playlist_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get images with optional filtering (public endpoint for display devices)"""
    try:
        # Get device token from cookie
        cookie_manager = CookieManager()
        device_token = cookie_manager.get_display_device_cookie(request)
        
        if not device_token:
            raise HTTPException(status_code=401, detail="Display device not authenticated")
        
        # Verify device exists and is authorized
        device_service = DisplayDeviceService(db)
        device = device_service.get_device_by_token(device_token)
        
        if not device:
            raise HTTPException(status_code=404, detail="Display device not found")
        
        if device.status != DeviceStatus.AUTHORIZED:
            raise HTTPException(status_code=403, detail="Display device not authorized")
        
        # Get images
        image_service = ImageService(db)
        
        if album_id:
            images = image_service.get_images_by_album(album_id)
        elif playlist_id:
            images = image_service.get_images_by_playlist(playlist_id)
        else:
            images = image_service.get_all_images(limit, offset)
        
        return {
            "message": "Images retrieved successfully",
            "data": [image.to_dict() for image in images],
            "status_code": 200
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get public images error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve images"
        )

@router.get("/")
async def get_images(
    album_id: Optional[int] = None,
    playlist_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get images with optional filtering"""
    try:
        image_service = ImageService(db)
        
        if album_id:
            images = image_service.get_images_by_album(album_id)
        elif playlist_id:
            images = image_service.get_images_by_playlist(playlist_id)
        else:
            images = image_service.get_all_images(limit, offset)
        
        return {
            "message": "Images retrieved successfully",
            "data": [image.to_dict() for image in images],
            "status_code": 200
        }
        
    except Exception as e:
        logger.error(f"Get images error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve images"
        )

@router.get("/{image_id}")
async def get_image(
    image_id: int,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get a specific image by ID"""
    try:
        image_service = ImageService(db)
        image = image_service.get_image_by_id(image_id)
        
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found"
            )
        
        return {
            "message": "Image retrieved successfully",
            "data": image.to_dict(),
            "status_code": 200
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get image error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve image"
        )

@router.get("/{image_id}/scaled-versions")
async def get_scaled_versions(
    image_id: int,
    db: Session = Depends(get_db)
):
    """Get available scaled versions for an image"""
    try:
        image_service = ImageService(db)
        image = image_service.get_image_by_id(image_id)
        
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found"
            )
        
        # Get the base filename without extension
        base_filename = Path(image.filename).stem
        
        # Check for scaled versions in the upload directory
        scaled_versions = []
        upload_path = Path(image_storage_service.upload_path)
        
        # Look through year/month subdirectories
        for year_dir in upload_path.iterdir():
            if year_dir.is_dir():
                for month_dir in year_dir.iterdir():
                    if month_dir.is_dir():
                        for user_dir in month_dir.iterdir():
                            if user_dir.is_dir():
                                # Look for scaled versions
                                for file_path in user_dir.glob(f"{base_filename}_*x*.jpg"):
                                    if file_path.name != image.filename:
                                        # Extract dimensions from filename
                                        filename_without_ext = file_path.stem
                                        if '_' in filename_without_ext:
                                            size_part = filename_without_ext.split('_')[-1]
                                            if 'x' in size_part:
                                                try:
                                                    width, height = map(int, size_part.split('x'))
                                                    scaled_versions.append({
                                                        "dimensions": f"{width}x{height}",
                                                        "width": width,
                                                        "height": height,
                                                        "filename": file_path.name
                                                    })
                                                except ValueError:
                                                    continue
                        else:
                            # Also check in month directory (no user subdirectory)
                            for file_path in month_dir.glob(f"{base_filename}_*x*.jpg"):
                                if file_path.name != image.filename:
                                    filename_without_ext = file_path.stem
                                    if '_' in filename_without_ext:
                                        size_part = filename_without_ext.split('_')[-1]
                                        if 'x' in size_part:
                                            try:
                                                width, height = map(int, size_part.split('x'))
                                                scaled_versions.append({
                                                    "dimensions": f"{width}x{height}",
                                                    "width": width,
                                                    "height": height,
                                                    "filename": file_path.name
                                                })
                                            except ValueError:
                                                continue
        
        return {
            "image_id": image_id,
            "original_filename": image.filename,
            "scaled_versions": scaled_versions
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting scaled versions for image {image_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get scaled versions"
        )

@router.get("/{image_id}/file")
async def get_image_file(
    image_id: int,
    size: str = "original",
    db: Session = Depends(get_db)
):
    """Get the actual image file"""
    try:
        image_service = ImageService(db)
        image = image_service.get_image_by_id(image_id)
        
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found"
            )
        
        # Get file path
        if size == "original":
            file_path = image_storage_service.get_image_path(image.filename)
        else:
            file_path = image_storage_service.get_thumbnail_path(image.filename, size)
        
        if not file_path or not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image file not found"
            )
        
        # Set up enhanced caching headers for home network
        headers = {}
        
        # Cache original images for 1 year (they don't change)
        if size == "original":
            headers["Cache-Control"] = "public, max-age=31536000, immutable"
            headers["Expires"] = (datetime.utcnow() + timedelta(days=365)).strftime("%a, %d %b %Y %H:%M:%S GMT")
        else:
            # Cache thumbnails for 30 days
            headers["Cache-Control"] = "public, max-age=2592000"
            headers["Expires"] = (datetime.utcnow() + timedelta(days=30)).strftime("%a, %d %b %Y %H:%M:%S GMT")
        
        # Add ETag for better caching
        headers["ETag"] = f'"{image.filename}_{size}_{image.uploaded_at.timestamp()}"'
        
        # Add Last-Modified header
        headers["Last-Modified"] = image.uploaded_at.strftime("%a, %d %b %Y %H:%M:%S GMT")
        
        # Add home network specific headers
        headers["X-Content-Type-Options"] = "nosniff"
        headers["X-Frame-Options"] = "SAMEORIGIN"
        headers["X-Cache"] = "HIT"  # Indicate this is served from cache
        
        # Add Vary header for format negotiation
        headers["Vary"] = "Accept"
        
        return FileResponse(
            path=str(file_path),
            media_type=image.mime_type,
            filename=image.original_filename,
            headers=headers
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get image file error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve image file"
        )

@router.put("/{image_id}")
async def update_image(
    request: Request,
    image_id: int,
    album_id: Optional[int] = Form(None),
    playlist_id: Optional[int] = Form(None),
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Update image metadata"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        image_service = ImageService(db)
        
        # Check if image exists
        image = image_service.get_image_by_id(image_id)
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found"
            )
        
        # Update image
        updated_image = image_service.update_image(
            image_id,
            album_id=album_id,
            playlist_id=playlist_id
        )
        
        return {
            "message": "Image updated successfully",
            "data": updated_image.to_dict(),
            "status_code": 200
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update image error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update image"
        )

@router.delete("/{image_id}")
async def delete_image(
    request: Request,
    image_id: int,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Delete an image"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        image_service = ImageService(db)
        
        # Check if image exists
        image = image_service.get_image_by_id(image_id)
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found"
            )
        
        # Delete image
        success = image_service.delete_image(image_id)
        
        if success:
            return {
                "message": "Image deleted successfully",
                "data": None,
                "status_code": 200
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete image"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete image error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete image"
        )

@router.get("/stats/overview")
async def get_image_statistics(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get image statistics"""
    try:
        image_service = ImageService(db)
        stats = image_service.get_image_statistics()
        
        return {
            "message": "Image statistics retrieved successfully",
            "data": stats,
            "status_code": 200
        }
        
    except Exception as e:
        logger.error(f"Get image statistics error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve image statistics"
        )

@router.get("/duplicates/find")
async def find_duplicate_images(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Find potential duplicate images"""
    try:
        image_service = ImageService(db)
        duplicates = image_service.get_duplicate_images()
        
        return {
            "message": "Duplicate images retrieved successfully",
            "data": [
                [image.to_dict() for image in group] 
                for group in duplicates
            ],
            "status_code": 200
        }
        
    except Exception as e:
        logger.error(f"Find duplicate images error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to find duplicate images"
        )

@router.get("/{image_id}/optimized")
async def get_optimized_image(
    image_id: int,
    width: Optional[int] = None,
    height: Optional[int] = None,
    quality: int = 85,
    format: str = "auto",
    db: Session = Depends(get_db)
):
    """Get optimized image with custom dimensions and quality"""
    try:
        image_service = ImageService(db)
        image = image_service.get_image_by_id(image_id)
        
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found"
            )
        
        # Get original file path
        file_path = image_storage_service.get_image_path(image.filename)
        if not file_path or not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image file not found"
            )
        
        # If no custom dimensions requested, serve original with caching
        if not width and not height:
            headers = {
                "Cache-Control": "public, max-age=31536000, immutable",
                "Expires": (datetime.utcnow() + timedelta(days=365)).strftime("%a, %d %b %Y %H:%M:%S GMT"),
                "ETag": f'"{image.filename}_original_{image.uploaded_at.timestamp()}"',
                "Last-Modified": image.uploaded_at.strftime("%a, %d %b %Y %H:%M:%S GMT")
            }
            
            return FileResponse(
                path=str(file_path),
                media_type=image.mime_type,
                filename=image.original_filename,
                headers=headers
            )
        
        # For custom dimensions, we would need to implement on-the-fly resizing
        # For now, return the original with appropriate caching
        headers = {
            "Cache-Control": "public, max-age=2592000",  # 30 days for dynamic content
            "Expires": (datetime.utcnow() + timedelta(days=30)).strftime("%a, %d %b %Y %H:%M:%S GMT"),
            "ETag": f'"{image.filename}_optimized_{width}x{height}_{quality}_{image.uploaded_at.timestamp()}"',
            "Last-Modified": image.uploaded_at.strftime("%a, %d %b %Y %H:%M:%S GMT")
        }
        
        return FileResponse(
            path=str(file_path),
            media_type=image.mime_type,
            filename=image.original_filename,
            headers=headers
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get optimized image error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve optimized image"
        )

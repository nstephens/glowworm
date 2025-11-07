from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Request, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging
from pathlib import Path
from datetime import datetime, timedelta
import zipfile
import io
import os

from models import get_db, Image, Album, Playlist
from models.user import User
from models.display_device import DisplayDevice, DeviceStatus
from utils.middleware import require_auth
from services.image_service import ImageService
from services.image_storage_service import image_storage_service
from services.display_device_service import DisplayDeviceService
from utils.csrf import csrf_protection
from utils.cookies import CookieManager
from utils.retry import image_processing_circuit_breaker
from websocket.processing_notifier import (
    notify_thumbnail_complete,
    notify_thumbnail_failed,
    notify_variant_complete,
    notify_variant_failed,
    notify_processing_complete,
    notify_processing_failed
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/images", tags=["images"])


def process_image_background(image_id: int, filename: str, user_id: int):
    """
    Background task for processing image thumbnails and variants.
    
    This function runs asynchronously after the upload response is returned.
    It updates the database status as processing progresses.
    
    Includes:
    - Circuit breaker pattern to prevent repeated failures
    - Automatic retry with exponential backoff (via decorated functions)
    - Comprehensive error handling and status tracking
    
    Args:
        image_id: Database ID of the image
        filename: Stored filename of the image
        user_id: User ID for storage path resolution
    """
    from models import database as db_module
    
    # Ensure database is initialized
    db_module.ensure_database_initialized()
    
    # Check circuit breaker before processing
    if image_processing_circuit_breaker.is_open(image_id):
        logger.error(
            f"⛔ Circuit breaker OPEN for image {image_id}. "
            f"Too many failures ({image_processing_circuit_breaker.get_failure_count(image_id)}). "
            "Skipping processing. Use manual retry to reset."
        )
        
        # Update database to reflect permanent failure
        db = db_module.SessionLocal()
        try:
            image = db.query(Image).filter(Image.id == image_id).first()
            if image:
                image.processing_status = 'failed'
                image.thumbnail_status = 'failed'
                image.variant_status = 'failed'
                image.processing_error = (
                    "Processing blocked by circuit breaker due to repeated failures. "
                    "Use manual retry endpoint to reset."
                )
                db.commit()
        finally:
            db.close()
        return
    
    db = db_module.SessionLocal()
    try:
        logger.info(f"🎬 Starting background processing for image {image_id}")
        
        # Get the image record
        image = db.query(Image).filter(Image.id == image_id).first()
        if not image:
            logger.error(f"Image {image_id} not found for background processing")
            return
        
        # Update status to 'processing'
        image.processing_status = 'processing'
        image.processing_attempts += 1
        image.last_processing_attempt = datetime.now()
        db.commit()
        
        # Step 1: Generate thumbnails (priority)
        try:
            logger.info(f"📸 Generating thumbnails for image {image_id}")
            image.thumbnail_status = 'processing'
            db.commit()
            
            thumbnail_paths = image_storage_service.process_thumbnails(
                filename,
                user_id=user_id
            )
            
            image.thumbnail_status = 'complete'
            db.commit()
            logger.info(f"✅ Thumbnails complete for image {image_id}: {len(thumbnail_paths)} sizes")
            
            # Notify via WebSocket
            notify_thumbnail_complete(image_id, len(thumbnail_paths))
            
        except Exception as e:
            logger.error(f"❌ Thumbnail generation failed for image {image_id}: {e}", exc_info=True)
            image.thumbnail_status = 'failed'
            image.processing_error = f"Thumbnail generation failed: {str(e)}"
            db.commit()
            
            # Notify failure via WebSocket
            notify_thumbnail_failed(image_id, str(e))
        
        # Step 2: Generate display variants
        try:
            logger.info(f"🖼️  Generating variants for image {image_id}")
            image.variant_status = 'processing'
            db.commit()
            
            variant_paths = image_storage_service.process_variants(
                filename,
                user_id=user_id
            )
            
            image.variant_status = 'complete'
            db.commit()
            logger.info(f"✅ Variants complete for image {image_id}: {len(variant_paths)} sizes")
            
            # Notify via WebSocket
            notify_variant_complete(image_id, len(variant_paths))
            
        except Exception as e:
            logger.error(f"❌ Variant generation failed for image {image_id}: {e}", exc_info=True)
            image.variant_status = 'failed'
            if image.processing_error:
                image.processing_error += f"; Variant generation failed: {str(e)}"
            else:
                image.processing_error = f"Variant generation failed: {str(e)}"
            db.commit()
            
            # Notify failure via WebSocket
            notify_variant_failed(image_id, str(e))
        
        # Update overall processing status
        if image.thumbnail_status == 'complete' and image.variant_status == 'complete':
            image.processing_status = 'complete'
            image.processing_completed_at = datetime.now()
            logger.info(f"🎉 All processing complete for image {image_id}")
            # Record success in circuit breaker
            image_processing_circuit_breaker.record_success(image_id)
            # Notify complete via WebSocket
            notify_processing_complete(image_id)
        elif image.thumbnail_status == 'failed' or image.variant_status == 'failed':
            image.processing_status = 'failed'
            logger.error(f"⚠️  Processing failed for image {image_id}")
            # Record failure in circuit breaker
            image_processing_circuit_breaker.record_failure(image_id)
            # Notify failure via WebSocket
            notify_processing_failed(image_id, image.processing_error or "Processing failed")
        else:
            image.processing_status = 'complete'  # Partial success
            image.processing_completed_at = datetime.now()
            logger.warning(f"⚠️  Processing partially complete for image {image_id}")
            # Partial success - clear circuit breaker
            image_processing_circuit_breaker.record_success(image_id)
            # Notify complete via WebSocket
            notify_processing_complete(image_id)
        
        db.commit()
        logger.info(f"✅ Background processing finished for image {image_id}")
        
    except Exception as e:
        logger.error(f"❌ Background processing error for image {image_id}: {e}", exc_info=True)
        # Record failure in circuit breaker
        image_processing_circuit_breaker.record_failure(image_id)
        try:
            image = db.query(Image).filter(Image.id == image_id).first()
            if image:
                image.processing_status = 'failed'
                image.thumbnail_status = 'failed'
                image.variant_status = 'failed'
                image.processing_error = f"Background processing error: {str(e)}"
                db.commit()
                
                # Notify failure via WebSocket (with error handling)
                try:
                    notify_processing_failed(image_id, str(e), stage="background_task")
                except Exception as ws_error:
                    logger.warning(f"Failed to send WebSocket notification: {ws_error}")
                    
        except Exception as commit_error:
            logger.error(f"Failed to update error status: {commit_error}")
    finally:
        db.close()


@router.post("/upload")
async def upload_image(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    album_id: Optional[int] = Form(None),
    playlist_id: Optional[int] = Form(None),
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Upload and process an image with background processing.
    
    Fast path (<500ms):
    - Validates image
    - Extracts EXIF metadata
    - Saves original file
    - Creates database record with processing_status='pending'
    
    Background processing (async):
    - Generates thumbnails (3 sizes)
    - Generates display variants
    - Updates processing status in database
    """
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
        
        # FAST PATH: Validate and store original only (no thumbnail/variant generation)
        image_metadata = image_storage_service.validate_and_store_original(
            file_content, 
            file.filename,
            user_id=current_user.id
        )
        
        # Check for duplicates before creating database record
        image_service = ImageService(db)
        existing_image = image_service.get_image_by_hash(image_metadata['file_hash'])
        
        if existing_image:
            logger.info(f"Duplicate image detected: {file.filename} matches existing image ID {existing_image.id}")
            # Clean up the uploaded original since it's a duplicate
            try:
                import os
                os.remove(image_metadata['storage_path'])
                logger.info(f"Cleaned up duplicate file: {image_metadata['storage_path']}")
            except Exception as e:
                logger.warning(f"Failed to clean up duplicate file: {e}")
            
            return {
                "message": "Duplicate image - already exists in library",
                "data": existing_image.to_dict(),
                "status_code": 200,
                "is_duplicate": True
            }
        
        # Create database record with processing_status='pending'
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
        
        # BACKGROUND PROCESSING: Queue thumbnail and variant generation
        # This happens asynchronously after the response is returned
        background_tasks.add_task(
            process_image_background,
            image.id,
            image.filename,
            current_user.id
        )
        
        logger.info(f"Image {image.id} uploaded successfully, queued for background processing")
        
        return {
            "message": "Image uploaded successfully",
            "data": image.to_dict(),
            "status_code": 200,
            "background_processing": True
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

# Request model for batch duplicate check
class BatchDuplicateCheckRequest(BaseModel):
    file_hashes: List[str]

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

@router.post("/check-duplicates-batch")
async def check_duplicates_batch(
    request_data: BatchDuplicateCheckRequest,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Check multiple images for duplicates in a single request"""
    try:
        image_service = ImageService(db)
        results = {}
        
        # Get all existing images with the provided hashes in one query
        existing_images = db.query(Image).filter(Image.file_hash.in_(request_data.file_hashes)).all()
        existing_hashes = {img.file_hash: img for img in existing_images}
        
        # Check each hash
        for file_hash in request_data.file_hashes:
            if file_hash in existing_hashes:
                results[file_hash] = {
                    "is_duplicate": True,
                    "existing_image": existing_hashes[file_hash].to_dict(),
                    "message": "Image already exists"
                }
            else:
                results[file_hash] = {
                    "is_duplicate": False,
                    "message": "Image is unique"
                }
        
        return {
            "results": results,
            "total_checked": len(request_data.file_hashes),
            "duplicates_found": sum(1 for r in results.values() if r["is_duplicate"])
        }
            
    except Exception as e:
        logger.error(f"Batch duplicate check error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Batch duplicate check failed"
        )

@router.get("/{image_id}/processing-status")
async def get_processing_status(
    image_id: int,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Get the current background processing status for an image.
    
    Returns detailed information about thumbnail generation, variant creation,
    and overall processing status including error messages and attempt counts.
    """
    try:
        image_service = ImageService(db)
        image = image_service.get_image_by_id(image_id)
        
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found"
            )
        
        return {
            "image_id": image.id,
            "processing_status": image.processing_status,
            "thumbnail_status": image.thumbnail_status,
            "variant_status": image.variant_status,
            "processing_error": image.processing_error,
            "processing_attempts": image.processing_attempts,
            "last_processing_attempt": image.last_processing_attempt.isoformat() if image.last_processing_attempt else None,
            "processing_completed_at": image.processing_completed_at.isoformat() if image.processing_completed_at else None,
            "uploaded_at": image.uploaded_at.isoformat() if image.uploaded_at else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Processing status error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve processing status"
        )

@router.post("/{image_id}/retry-processing")
async def retry_processing(
    request: Request,
    image_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Manually retry failed image processing.
    
    Resets processing status and queues thumbnail/variant generation again.
    Also resets the circuit breaker for this image.
    """
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        image_service = ImageService(db)
        image = image_service.get_image_by_id(image_id)
        
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found"
            )
        
        # Reset circuit breaker to allow retry
        image_processing_circuit_breaker.reset(image_id)
        logger.info(f"Circuit breaker reset for image {image_id}")
        
        # Reset processing status fields
        image.processing_status = 'pending'
        image.thumbnail_status = 'pending'
        image.variant_status = 'pending'
        image.processing_error = None
        db.commit()
        
        # Queue background processing
        background_tasks.add_task(
            process_image_background,
            image.id,
            image.filename,
            current_user.id
        )
        
        logger.info(f"Manual retry queued for image {image_id}")
        
        return {
            "message": "Processing retry queued successfully",
            "image_id": image_id,
            "status": "pending"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Retry processing error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retry processing"
        )

@router.post("/admin/retry-all-failed")
async def retry_all_failed_processing(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Admin endpoint to retry all failed image processing jobs.
    
    Resets all failed images to 'pending' status and queues them for
    background processing. Also resets the circuit breaker for each image.
    """
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        # Get all failed images
        failed_images = db.query(Image).filter(Image.processing_status == 'failed').all()
        
        if not failed_images:
            return {
                "message": "No failed jobs to retry",
                "retry_count": 0
            }
        
        retry_count = 0
        for image in failed_images:
            # Reset circuit breaker
            image_processing_circuit_breaker.reset(image.id)
            
            # Reset processing status
            image.processing_status = 'pending'
            image.thumbnail_status = 'pending'
            image.variant_status = 'pending'
            image.processing_error = None
            
            # Queue background processing
            background_tasks.add_task(
                process_image_background,
                image.id,
                image.filename,
                current_user.id
            )
            
            retry_count += 1
        
        db.commit()
        
        logger.info(f"Batch retry: queued {retry_count} failed images for processing")
        
        return {
            "message": f"Successfully queued {retry_count} failed jobs for retry",
            "retry_count": retry_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch retry error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retry batch processing"
        )

@router.get("/admin/processing-queue")
async def get_processing_queue_status(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Admin endpoint for monitoring the background processing queue.
    
    Returns statistics about pending, processing, and failed images,
    along with a list of recent jobs for detailed monitoring.
    """
    try:
        # Check if user is admin (optional - can add role check here)
        # For now, any authenticated user can access
        
        # Get processing statistics
        pending_count = db.query(Image).filter(Image.processing_status == 'pending').count()
        processing_count = db.query(Image).filter(Image.processing_status == 'processing').count()
        failed_count = db.query(Image).filter(Image.processing_status == 'failed').count()
        complete_count = db.query(Image).filter(Image.processing_status == 'complete').count()
        
        # Get counts by individual status types
        thumbnail_pending = db.query(Image).filter(Image.thumbnail_status == 'pending').count()
        thumbnail_processing = db.query(Image).filter(Image.thumbnail_status == 'processing').count()
        thumbnail_failed = db.query(Image).filter(Image.thumbnail_status == 'failed').count()
        
        variant_pending = db.query(Image).filter(Image.variant_status == 'pending').count()
        variant_processing = db.query(Image).filter(Image.variant_status == 'processing').count()
        variant_failed = db.query(Image).filter(Image.variant_status == 'failed').count()
        
        # Get recent jobs (last 20 non-complete jobs)
        recent_jobs = db.query(Image)\
            .filter(Image.processing_status.in_(['pending', 'processing', 'failed']))\
            .order_by(Image.last_processing_attempt.desc().nulls_last())\
            .limit(20)\
            .all()
        
        # Calculate oldest pending job age
        oldest_pending = db.query(Image)\
            .filter(Image.processing_status == 'pending')\
            .order_by(Image.uploaded_at.asc())\
            .first()
        
        oldest_job_age_seconds = None
        if oldest_pending and oldest_pending.uploaded_at:
            age = datetime.now() - oldest_pending.uploaded_at.replace(tzinfo=None)
            oldest_job_age_seconds = int(age.total_seconds())
        
        return {
            "queue_size": pending_count,
            "processing_count": processing_count,
            "failed_count": failed_count,
            "complete_count": complete_count,
            "oldest_job_age_seconds": oldest_job_age_seconds,
            "thumbnail_stats": {
                "pending": thumbnail_pending,
                "processing": thumbnail_processing,
                "failed": thumbnail_failed
            },
            "variant_stats": {
                "pending": variant_pending,
                "processing": variant_processing,
                "failed": variant_failed
            },
            "jobs": [
                {
                    "id": job.id,
                    "filename": job.original_filename,
                    "processing_status": job.processing_status,
                    "thumbnail_status": job.thumbnail_status,
                    "variant_status": job.variant_status,
                    "attempts": job.processing_attempts,
                    "error": job.processing_error,
                    "uploaded_at": job.uploaded_at.isoformat() if job.uploaded_at else None,
                    "last_attempt": job.last_processing_attempt.isoformat() if job.last_processing_attempt else None,
                    "completed_at": job.processing_completed_at.isoformat() if job.processing_completed_at else None
                }
                for job in recent_jobs
            ]
        }
        
    except Exception as e:
        logger.error(f"Processing queue status error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve queue status"
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

@router.get("/{image_id}/resolutions")
async def get_image_resolutions(
    image_id: int,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get available resolution variants for a specific image"""
    try:
        image_service = ImageService(db)
        image = image_service.get_image_by_id(image_id)
        
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found"
            )
        
        # Get available resolution variants
        from services.image_storage_service import image_storage_service
        available_resolutions = image_storage_service.get_available_resolutions(image.filename)
        
        return {
            "message": "Image resolutions retrieved successfully",
            "data": {
                "image_id": image_id,
                "original": {
                    "dimensions": f"{image.width}x{image.height}",
                    "width": image.width,
                    "height": image.height,
                    "filename": image.filename,
                    "url": f"/api/images/{image_id}/file"
                },
                "variants": available_resolutions
            },
            "status_code": 200
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get image resolutions error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve image resolutions"
        )

@router.post("/regenerate-resolutions")
async def regenerate_image_resolutions(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Start background regeneration of resolution variants for all images"""
    try:
        logger.info("🔄 Starting background image resolution regeneration...")
        
        # Get all images count for estimation
        image_service = ImageService(db)
        images = image_service.get_all_images(limit=10000)
        
        if not images:
            return {
                "message": "No images found to regenerate",
                "data": {"total_images": 0, "status": "completed", "task_id": None},
                "status_code": 200
            }
        
        # Get current display sizes
        display_sizes = image_storage_service._load_display_sizes()
        display_size_strings = [f"{w}x{h}" for w, h in display_sizes]
        logger.info(f"🔍 Display sizes loaded: {display_sizes}")
        logger.info(f"🔍 Display size strings: {display_size_strings}")
        
        # Generate unique task ID
        import uuid
        task_id = str(uuid.uuid4())
        
        # Start progress tracking
        from services.regeneration_progress_service import regeneration_progress_service
        regeneration_progress_service.start_task(task_id, len(images), display_size_strings)
        
        # Clean up existing scaled images first
        logger.info(f"🧹 Cleaning up existing scaled images...")
        _cleanup_scaled_images()
        
        # Start background task
        logger.info(f"🚀 About to start background task for {len(images)} images with task ID: {task_id}")
        background_tasks.add_task(_regenerate_resolutions_background, task_id, images, display_sizes)
        
        logger.info(f"🚀 Background regeneration started for {len(images)} images with task ID: {task_id}")
        
        return {
            "message": "Resolution regeneration started in background",
            "data": {
                "task_id": task_id,
                "total_images": len(images),
                "display_sizes": [f"{w}x{h}" for w, h in display_sizes],
                "status": "started"
            },
            "status_code": 200
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to start resolution regeneration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start resolution regeneration: {str(e)}"
        )

def _cleanup_scaled_images():
    """Clean up existing scaled images directory"""
    try:
        from pathlib import Path
        from services.image_storage_service import image_storage_service
        
        scaled_dir = image_storage_service.upload_path / "scaled"
        if scaled_dir.exists():
            # Count existing files
            existing_files = list(scaled_dir.glob("*"))
            file_count = len(existing_files)
            
            if file_count > 0:
                logger.info(f"🗑️ Removing {file_count} existing scaled images...")
                
                # Remove all files in scaled directory
                for file_path in existing_files:
                    try:
                        file_path.unlink()
                    except Exception as e:
                        logger.warning(f"Failed to delete {file_path}: {e}")
                
                logger.info(f"✅ Cleaned up {file_count} scaled images")
            else:
                logger.info("📁 No existing scaled images to clean up")
        else:
            logger.info("📁 Scaled directory doesn't exist, nothing to clean up")
            
    except Exception as e:
        logger.error(f"❌ Failed to cleanup scaled images: {e}")

def _regenerate_resolutions_background(task_id: str, images, display_sizes):
    """Background task to regenerate image resolutions with progress tracking"""
    from services.regeneration_progress_service import regeneration_progress_service
    
    try:
        logger.info(f"🔄 Background task {task_id}: Processing {len(images)} images...")
        logger.info(f"🔍 Display sizes: {display_sizes}")
        logger.info(f"🔍 First image: {images[0].filename if images else 'No images'}")
        
        processed_count = 0
        error_count = 0
        
        for i, image in enumerate(images):
            try:
                # Update progress (sync version - no WebSocket broadcast)
                regeneration_progress_service.update_progress_sync(
                    task_id, 
                    processed_count, 
                    error_count, 
                    image.filename
                )
                
                logger.info(f"🖼️ Processing image {i+1}/{len(images)}: {image.filename}")
                
                # Get original image file
                image_path = image_storage_service.get_image_path(image.filename)
                if not image_path or not image_path.exists():
                    logger.warning(f"⚠️ Original image file not found: {image.filename}")
                    error_count += 1
                    continue
                
                # Read original image bytes
                with open(image_path, 'rb') as f:
                    original_bytes = f.read()
                
                # Generate new scaled versions (only scale down, never up)
                for target_width, target_height in display_sizes:
                    try:
                        # Skip if target resolution is larger than original (scale up)
                        if target_width > image.width or target_height > image.height:
                            logger.info(f"⏭️ Skipping {target_width}x{target_height} for {image.filename} (would scale up from {image.width}x{image.height})")
                            continue
                        
                        # Generate scaled image (only scale down)
                        scaled_bytes = image_storage_service._generate_scaled_image(
                            original_bytes, target_width, target_height
                        )
                        
                        # Save scaled version to scaled subdirectory
                        scaled_filename = f"{Path(image.filename).stem}_{target_width}x{target_height}{Path(image.filename).suffix}"
                        scaled_dir = image_storage_service.upload_path / "scaled"
                        scaled_dir.mkdir(parents=True, exist_ok=True)
                        scaled_path = scaled_dir / scaled_filename
                        
                        with open(scaled_path, 'wb') as f:
                            f.write(scaled_bytes)
                        
                        logger.info(f"✅ Created {target_width}x{target_height} variant for {image.filename} at {scaled_path}")
                        
                    except Exception as e:
                        logger.error(f"❌ Failed to generate {target_width}x{target_height} for {image.filename}: {e}")
                        error_count += 1
                
                processed_count += 1
                
            except Exception as e:
                logger.error(f"❌ Failed to process image {image.id}: {e}")
                error_count += 1
        
        # Final progress update
        regeneration_progress_service.update_progress_sync(
            task_id, 
            processed_count, 
            error_count, 
            "Completed"
        )
        
        # Mark task as completed (sync version)
        regeneration_progress_service.complete_task_sync(task_id, success=True)
        
        logger.info(f"🎉 Background regeneration {task_id} complete! Processed: {processed_count}, Errors: {error_count}")
        
    except Exception as e:
        logger.error(f"❌ Background regeneration {task_id} failed: {e}")
        import traceback
        logger.error(f"❌ Background regeneration {task_id} traceback: {traceback.format_exc()}")
        regeneration_progress_service.complete_task_sync(task_id, success=False, error_message=str(e))

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
        
        # Ensure inline display in browsers
        headers["Content-Disposition"] = f'inline; filename="{image.original_filename}"'
        
        # Normalize MPO content-type to JPEG to avoid breaking clients
        media_type = (image.mime_type or "image/jpeg")
        if media_type.lower() == "image/mpo":
            media_type = "image/jpeg"
        return FileResponse(
            path=str(file_path),
            media_type=media_type,
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

@router.get("/{image_id}/smart")
async def get_image_smart(
    image_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Get image with smart resolution matching based on display device"""
    try:
        image_service = ImageService(db)
        image = image_service.get_image_by_id(image_id)
        
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found"
            )
        
        # Get device token from query parameters, headers, or cookies
        cookie_manager = CookieManager()
        device_token = (request.query_params.get('device_token') or 
                       request.headers.get('X-Device-Token') or
                       cookie_manager.get_display_device_cookie(request))
        
        if not device_token:
            # No device token provided, serve original image
            logger.info(f"No device token provided for image {image_id}, serving original")
            return await get_image_file(image_id, "original", db)
        
        # Get device information
        from services.display_device_service import DisplayDeviceService
        device_service = DisplayDeviceService(db)
        device = device_service.get_device_by_token(device_token)
        
        if not device:
            logger.warning(f"Device token {device_token[:8]}... not found, serving original")
            return await get_image_file(image_id, "original", db)
        
        # Get device resolution
        display_width = device.screen_width or 1920
        display_height = device.screen_height or 1080
        device_pixel_ratio = float(device.device_pixel_ratio or "1.0")
        
        # Calculate effective resolution
        effective_width = int(display_width * device_pixel_ratio)
        effective_height = int(display_height * device_pixel_ratio)
        
        # Find the best matching playlist variant for this device
        from services.playlist_variant_service import PlaylistVariantService
        variant_service = PlaylistVariantService(db)
        
        # Get the playlist this image belongs to
        playlist = db.query(Playlist).filter(Playlist.id == image.playlist_id).first()
        if not playlist:
            logger.warning(f"Image {image_id} has no associated playlist, serving original")
            return await get_image_file(image_id, "original", db)
        
        # Get the best variant for this device
        best_variant = variant_service.get_best_variant_for_device(
            playlist.id, display_width, display_height, device_pixel_ratio
        )
        
        from models.playlist_variant import PlaylistVariantType
        
        if not best_variant or best_variant.variant_type == PlaylistVariantType.ORIGINAL:
            logger.info(f"No suitable variant found for device {device_token[:8]}..., serving original")
            return await get_image_file(image_id, "original", db)
        
        # Look for the pre-scaled image for this resolution
        target_width = best_variant.target_width
        target_height = best_variant.target_height
        
        if not target_width or not target_height:
            logger.warning(f"Variant {best_variant.variant_type.value} has no target resolution, serving original")
            return await get_image_file(image_id, "original", db)
        
        # Construct the expected scaled filename
        scaled_filename = f"{image.filename.rsplit('.', 1)[0]}_{target_width}x{target_height}.{image.filename.rsplit('.', 1)[1]}"
        scaled_path = image_storage_service.upload_path / "scaled" / scaled_filename
        
        if not scaled_path.exists():
            logger.warning(f"Pre-scaled image {scaled_filename} not found on disk, serving original")
            return await get_image_file(image_id, "original", db)
        
        logger.info(f"Serving pre-scaled image {scaled_filename} for device {device_token[:8]}... (variant: {best_variant.variant_type.value}, display: {display_width}x{display_height})")
        
        # Set up caching headers for scaled images
        headers = {
            "Cache-Control": "public, max-age=31536000, immutable",  # Cache scaled images for 1 year
            "Expires": (datetime.utcnow() + timedelta(days=365)).strftime("%a, %d %b %Y %H:%M:%S GMT"),
            "ETag": f'"{scaled_filename}_{image.uploaded_at.timestamp()}"',
            "Last-Modified": image.uploaded_at.strftime("%a, %d %b %Y %H:%M:%S GMT"),
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "SAMEORIGIN",
            "X-Cache": "HIT",
            "Vary": "Accept",
            "X-Resolution-Match": f"{target_width}x{target_height}",
            "X-Variant-Type": best_variant.variant_type.value
        }
        # Ensure inline display in browsers
        headers["Content-Disposition"] = f'inline; filename="{image.original_filename}"'
        
        # Normalize MPO content-type to JPEG for scaled variants
        media_type = (image.mime_type or "image/jpeg")
        if media_type.lower() == "image/mpo":
            media_type = "image/jpeg"
        return FileResponse(
            path=str(scaled_path),
            media_type=media_type,
            filename=image.original_filename,
            headers=headers
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Smart image serving error: {e}")
        # Fallback to original image on error
        return await get_image_file(image_id, "original", db)

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
            
            media_type = (image.mime_type or "image/jpeg")
            if media_type.lower() == "image/mpo":
                media_type = "image/jpeg"
            # Ensure inline display in browsers
            headers["Content-Disposition"] = f'inline; filename="{image.original_filename}"'
            return FileResponse(
                path=str(file_path),
                media_type=media_type,
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
        
        media_type = (image.mime_type or "image/jpeg")
        if media_type.lower() == "image/mpo":
            media_type = "image/jpeg"
        # Ensure inline display in browsers
        headers["Content-Disposition"] = f'inline; filename="{image.original_filename}"'
        return FileResponse(
            path=str(file_path),
            media_type=media_type,
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

@router.get("/{image_id}/debug")
async def debug_image_info(
    image_id: int,
    db: Session = Depends(get_db)
):
    """Debug endpoint to check image file paths and thumbnail resolution"""
    try:
        image_service = ImageService(db)
        image = image_service.get_image_by_id(image_id)
        
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found"
            )
        
        # Get file paths
        original_path = image_storage_service.get_image_path(image.filename)
        thumbnail_path = image_storage_service.get_thumbnail_path(image.filename, "medium")
        
        return {
            "image_id": image.id,
            "filename": image.filename,
            "original_filename": image.original_filename,
            "album_id": image.album_id,
            "file_hash": image.file_hash,
            "paths": {
                "original_exists": original_path.exists() if original_path else False,
                "original_path": str(original_path) if original_path else None,
                "thumbnail_exists": thumbnail_path.exists() if thumbnail_path else False,
                "thumbnail_path": str(thumbnail_path) if thumbnail_path else None,
            },
            "urls": {
                "url": image.to_dict()["url"],
                "thumbnail_url": image.to_dict()["thumbnail_url"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Debug image info error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get debug info"
        )


@router.post("/process-colors")
async def process_all_image_colors(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Batch process dominant colors for all images that don't have them yet.
    Runs asynchronously in background.
    """
    try:
        from services.color_extractor import color_extractor_service
        from services.image_storage_service import image_storage_service
        
        # Find images without dominant colors
        images_to_process = db.query(Image).filter(
            Image.dominant_colors == None
        ).all()
        
        logger.info(f"Found {len(images_to_process)} images to process for color extraction")
        
        # Add background task for each image
        def extract_and_save_colors(image_id: int):
            """Background task to extract and save colors for an image"""
            try:
                # Get fresh session for background task
                from models import SessionLocal
                bg_db = SessionLocal()
                
                try:
                    image = bg_db.query(Image).filter(Image.id == image_id).first()
                    if not image:
                        logger.warning(f"Image {image_id} not found during color extraction")
                        return
                    
                    # Get full file path
                    file_path = image_storage_service.get_image_path(image.filename)
                    if not file_path:
                        logger.warning(f"File path not found for image {image_id}")
                        return
                    
                    # Extract colors
                    colors = color_extractor_service.extract_colors(file_path, color_count=3, quality=10)
                    
                    if colors:
                        # Save to database
                        image.dominant_colors = colors
                        bg_db.commit()
                        logger.info(f"Saved colors for image {image_id}: {colors}")
                    else:
                        logger.warning(f"Failed to extract colors for image {image_id}")
                        
                finally:
                    bg_db.close()
                    
            except Exception as e:
                logger.error(f"Error in background color extraction for image {image_id}: {e}")
        
        # Queue all tasks
        for image in images_to_process:
            background_tasks.add_task(extract_and_save_colors, image.id)
        
        return {
            "message": f"Processing colors for {len(images_to_process)} images in background",
            "images_to_process": len(images_to_process)
        }
        
    except Exception as e:
        logger.error(f"Error starting color processing: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start color processing"
        )

class BulkDownloadRequest(BaseModel):
    image_ids: List[int]

@router.post("/download-zip")
async def download_images_as_zip(
    request: BulkDownloadRequest,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Download multiple images as a zip file"""
    try:
        if not request.image_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No image IDs provided"
            )
        
        # Get images from database
        images = db.query(Image).filter(Image.id.in_(request.image_ids)).all()
        
        if not images:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No images found"
            )
        
        # Create zip file in memory
        zip_buffer = io.BytesIO()
        
        # Use ZIP_STORED (no compression) for images since they're already compressed
        # This significantly speeds up zip creation for large image sets
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_STORED) as zip_file:
            for image in images:
                try:
                    # Get the image file path
                    image_path = image_storage_service.get_image_path(image.filename)
                    
                    if image_path and os.path.exists(image_path):
                        # Add file to zip with its original filename
                        zip_file.write(image_path, image.original_filename)
                        logger.debug(f"Added {image.original_filename} to zip")
                    else:
                        logger.warning(f"Image file not found: {image.filename}")
                except Exception as e:
                    logger.error(f"Error adding image {image.id} to zip: {e}")
                    # Continue with other images
        
        # Seek to beginning of buffer
        zip_buffer.seek(0)
        
        # Return zip file as streaming response
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename=glowworm-images-{datetime.now().strftime('%Y%m%d-%H%M%S')}.zip"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating zip download: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create download: {str(e)}"
        )

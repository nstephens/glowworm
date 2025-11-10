from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging

from models import get_db, Playlist, Image
from models.user import User
from models.display_device import DisplayDevice, DeviceStatus
from utils.middleware import get_current_user
from services.playlist_service import PlaylistService
from services.display_device_service import DisplayDeviceService
from services.playlist_variant_service import PlaylistVariantService
from utils.csrf import csrf_protection
from utils.cookies import CookieManager
from websocket.manager import connection_manager
import asyncio

logger = logging.getLogger(__name__)

class PlaylistCreateRequest(BaseModel):
    name: str
    is_default: bool = False

class PlaylistUpdateRequest(BaseModel):
    name: Optional[str] = None
    is_default: Optional[bool] = None
    display_time_seconds: Optional[int] = None
    display_mode: Optional[str] = None
    show_image_info: Optional[bool] = None
    show_exif_date: Optional[bool] = None

class PlaylistReorderRequest(BaseModel):
    image_ids: List[int]

class PlaylistRandomizeRequest(BaseModel):
    display_orientation: Optional[str] = 'portrait'
    preserve_pairing: Optional[bool] = True

router = APIRouter(prefix="/api/playlists", tags=["playlists"])

@router.post("/")
async def create_playlist(
    request: Request,
    create_data: PlaylistCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new playlist"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        playlist_service = PlaylistService(db)
        playlist = playlist_service.create_playlist(create_data.name, create_data.is_default)
        
        return {
            "success": True,
            "message": "Playlist created successfully",
            "playlist": playlist.to_dict()
        }
        
    except Exception as e:
        logger.error(f"Create playlist error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create playlist"
        )

@router.get("/")
async def get_playlists(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all playlists"""
    try:
        playlist_service = PlaylistService(db)
        playlists = playlist_service.get_all_playlists()
        
        return {
            "success": True,
            "playlists": [playlist.to_dict() for playlist in playlists],
            "count": len(playlists)
        }
        
    except Exception as e:
        logger.error(f"Get playlists error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve playlists"
        )

@router.get("/default")
async def get_default_playlist(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the default playlist"""
    try:
        playlist_service = PlaylistService(db)
        playlist = playlist_service.get_default_playlist()
        
        if not playlist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No default playlist found"
            )
        
        return {
            "success": True,
            "playlist": playlist.to_dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get default playlist error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve default playlist"
        )

# Public endpoint for display devices (must be before /{playlist_id} route)
@router.get("/public")
async def get_playlists_public(
    request: Request,
    db: Session = Depends(get_db)
):
    """Get all playlists (public endpoint for display devices)"""
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
        
        # Get playlists
        playlist_service = PlaylistService(db)
        playlists = playlist_service.get_all_playlists()
        
        return {
            "success": True,
            "data": [playlist.to_dict() for playlist in playlists],
            "count": len(playlists)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get public playlists error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve playlists"
        )

@router.get("/{playlist_id}")
async def get_playlist(
    playlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific playlist by ID"""
    try:
        playlist_service = PlaylistService(db)
        playlist = playlist_service.get_playlist_by_id(playlist_id)
        
        if not playlist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Playlist not found"
            )
        
        return {
            "success": True,
            "playlist": playlist.to_dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get playlist error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve playlist"
        )

@router.get("/slug/{slug}")
async def get_playlist_by_slug(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific playlist by slug"""
    try:
        playlist_service = PlaylistService(db)
        playlist = playlist_service.get_playlist_by_slug(slug)
        
        if not playlist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Playlist not found"
            )
        
        return {
            "success": True,
            "playlist": playlist.to_dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get playlist by slug error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve playlist"
        )

@router.put("/{playlist_id}")
async def update_playlist(
    request: Request,
    playlist_id: int,
    update_data: PlaylistUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update playlist"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        playlist_service = PlaylistService(db)
        
        # Check if playlist exists
        playlist = playlist_service.get_playlist_by_id(playlist_id)
        if not playlist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Playlist not found"
            )
        
        updated_playlist = playlist_service.update_playlist(
            playlist_id, 
            name=update_data.name, 
            is_default=update_data.is_default, 
            display_time_seconds=update_data.display_time_seconds,
            display_mode=update_data.display_mode,
            show_image_info=update_data.show_image_info,
            show_exif_date=update_data.show_exif_date
        )
        
        # Send WebSocket notification to all connected devices
        try:
            await connection_manager.broadcast_playlist_update(updated_playlist.to_dict())
        except Exception as e:
            logger.error(f"Failed to broadcast playlist update: {e}")
        
        return {
            "success": True,
            "message": "Playlist updated successfully",
            "playlist": updated_playlist.to_dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update playlist error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update playlist"
        )

@router.delete("/{playlist_id}")
async def delete_playlist(
    request: Request,
    playlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a playlist"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        playlist_service = PlaylistService(db)
        
        # Check if playlist exists
        playlist = playlist_service.get_playlist_by_id(playlist_id)
        if not playlist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Playlist not found"
            )
        
        success = playlist_service.delete_playlist(playlist_id)
        
        if success:
            return {
                "success": True,
                "message": "Playlist deleted successfully"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete playlist"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete playlist error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete playlist"
        )

@router.post("/{playlist_id}/images/{image_id}")
async def add_image_to_playlist(
    request: Request,
    playlist_id: int,
    image_id: int,
    position: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add image to playlist"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        playlist_service = PlaylistService(db)
        success = playlist_service.add_image_to_playlist(playlist_id, image_id, position)
        
        if success:
            # Get updated playlist data and send WebSocket notification
            updated_playlist = playlist_service.get_playlist_by_id(playlist_id)
            if updated_playlist:
                try:
                    await connection_manager.broadcast_playlist_update(updated_playlist.to_dict())
                except Exception as e:
                    logger.error(f"Failed to broadcast playlist update: {e}")
            
            return {
                "success": True,
                "message": "Image added to playlist successfully"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to add image to playlist"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add image to playlist error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add image to playlist"
        )

@router.delete("/{playlist_id}/images/{image_id}")
async def remove_image_from_playlist(
    request: Request,
    playlist_id: int,
    image_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove image from playlist"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        playlist_service = PlaylistService(db)
        success = playlist_service.remove_image_from_playlist(playlist_id, image_id)
        
        if success:
            # Get updated playlist data and send WebSocket notification
            updated_playlist = playlist_service.get_playlist_by_id(playlist_id)
            if updated_playlist:
                try:
                    await connection_manager.broadcast_playlist_update(updated_playlist.to_dict())
                except Exception as e:
                    logger.error(f"Failed to broadcast playlist update: {e}")
            
            return {
                "success": True,
                "message": "Image removed from playlist successfully"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to remove image from playlist"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Remove image from playlist error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove image from playlist"
        )

@router.put("/{playlist_id}/reorder")
async def reorder_playlist(
    request: Request,
    playlist_id: int,
    reorder_data: PlaylistReorderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reorder images in playlist and compute pairing sequence"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        from services.image_pairing_service import image_classification_service
        from models.image import Image
        from models.display_device import DisplayDevice
        
        playlist_service = PlaylistService(db)
        playlist = playlist_service.get_playlist_by_id(playlist_id)
        
        if not playlist:
            raise HTTPException(status_code=404, detail="Playlist not found")
        
        # Reorder playlist
        success = playlist_service.reorder_playlist(playlist_id, reorder_data.image_ids)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to reorder playlist"
            )
        
        # Get display orientation from assigned device (if any)
        display_orientation = 'portrait'  # Default
        if playlist.id:
            # Find device(s) using this playlist
            device = db.query(DisplayDevice).filter(DisplayDevice.playlist_id == playlist.id).first()
            if device and device.orientation:
                display_orientation = device.orientation
        
        # Compute pairing sequence
        images = db.query(Image).filter(Image.playlist_id == playlist_id).all()
        image_data = [{'id': img.id, 'width': img.width, 'height': img.height} for img in images]
        
        # Create ordered image data based on reorder_data
        image_map = {img['id']: img for img in image_data}
        ordered_images = [image_map[img_id] for img_id in reorder_data.image_ids if img_id in image_map]
        
        computed = image_classification_service.compute_sequence(ordered_images, display_orientation)
        playlist.computed_sequence = computed
        
        db.commit()
        db.refresh(playlist)
        
        # Auto-generate variants after sequence change (in background)
        import os
        use_celery = os.getenv('USE_CELERY', 'true').lower() == 'true'
        try:
            if use_celery:
                from tasks.image_processing import generate_playlist_variants
                generate_playlist_variants.apply_async(args=[playlist_id], queue='normal_priority')
                logger.info(f"Queued playlist variant generation for playlist {playlist_id}")
            else:
                # Fallback to synchronous (not recommended for production)
                from services.playlist_variant_service import PlaylistVariantService
                variant_service = PlaylistVariantService(db)
                variant_result = variant_service.generate_variants_for_playlist(playlist_id)
                logger.info(f"Auto-generated {variant_result.get('count', 0)} variants after reorder")
        except Exception as e:
            logger.error(f"Auto variant generation failed (non-fatal): {e}")
            # Don't fail the reorder if variant generation fails
        
        # Send WebSocket notification
        updated_playlist = playlist_service.get_playlist_by_id(playlist_id)
        if updated_playlist:
            try:
                await connection_manager.broadcast_playlist_update(updated_playlist.to_dict())
            except Exception as e:
                logger.error(f"Failed to broadcast playlist update: {e}")
        
        return {
            "success": True,
            "message": "Playlist reordered successfully",
            "computed_sequence": computed
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reorder playlist error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reorder playlist"
        )

@router.post("/{playlist_id}/validate-order")
async def validate_playlist_order(
    request: Request,
    playlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate playlist order for optimal pairing"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        # Get request body
        body = await request.json()
        sequence = body.get('sequence')
        display_orientation = body.get('display_orientation', 'portrait')
        
        if not sequence:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sequence is required"
            )
        
        # Get playlist and images
        from services.image_pairing_service import image_classification_service
        from models.image import Image
        
        playlist_service = PlaylistService(db)
        playlist = playlist_service.get_playlist_by_id(playlist_id)
        
        if not playlist:
            raise HTTPException(status_code=404, detail="Playlist not found")
        
        # Get image metadata
        images = db.query(Image).filter(Image.playlist_id == playlist_id).all()
        image_data = [{'id': img.id, 'width': img.width, 'height': img.height} for img in images]
        
        # Validate sequence
        validation = image_classification_service.validate_sequence_consistency(
            sequence, image_data, display_orientation
        )
        
        return {
            "is_valid": validation['is_valid'],
            "errors": validation['errors'],
            "optimal_sequence": validation['optimal_sequence'],
            "optimal_computed": validation['optimal_computed']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Validate playlist order error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate playlist order"
        )

@router.post("/{playlist_id}/randomize")
async def randomize_playlist(
    request: Request,
    playlist_id: int,
    randomize_data: PlaylistRandomizeRequest = PlaylistRandomizeRequest(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Randomize the order of images in playlist with smart pairing preservation"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        display_orientation = randomize_data.display_orientation
        preserve_pairing = randomize_data.preserve_pairing
        
        from services.image_pairing_service import image_classification_service
        from models.image import Image
        import random
        
        playlist_service = PlaylistService(db)
        playlist = playlist_service.get_playlist_by_id(playlist_id)
        
        if not playlist:
            raise HTTPException(status_code=404, detail="Playlist not found")
        
        # Get all images for this playlist
        images = db.query(Image).filter(Image.playlist_id == playlist_id).all()
        
        if preserve_pairing:
            # Smart randomize: shuffle while preserving optimal pairing
            image_data = [{'id': img.id, 'width': img.width, 'height': img.height} for img in images]
            
            # Separate by orientation
            landscapes = [img for img in image_data if image_classification_service.classify_image(img['width'], img['height']) == 'landscape']
            portraits = [img for img in image_data if image_classification_service.classify_image(img['width'], img['height']) == 'portrait']
            
            # Shuffle each group
            random.shuffle(landscapes)
            random.shuffle(portraits)
            
            # Combine and shuffle again for variety
            all_shuffled = landscapes + portraits
            random.shuffle(all_shuffled)
            
            # Compute optimal sequence from shuffled images
            computed = image_classification_service.compute_sequence(all_shuffled, display_orientation)
            new_sequence = [img_id for entry in computed for img_id in entry['images']]
            
            # Update playlist
            playlist.sequence = new_sequence
            playlist.computed_sequence = computed
        else:
            # Simple randomize without pairing preservation
            success = playlist_service.randomize_playlist(playlist_id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to randomize playlist"
                )
        
        db.commit()
        db.refresh(playlist)
        
        # Auto-generate variants after sequence change (in background)
        import os
        use_celery = os.getenv('USE_CELERY', 'true').lower() == 'true'
        try:
            if use_celery:
                from tasks.image_processing import generate_playlist_variants
                generate_playlist_variants.apply_async(args=[playlist_id], queue='normal_priority')
                logger.info(f"Queued playlist variant generation for playlist {playlist_id}")
            else:
                # Fallback to synchronous (not recommended for production)
                from services.playlist_variant_service import PlaylistVariantService
                variant_service = PlaylistVariantService(db)
                variant_result = variant_service.generate_variants_for_playlist(playlist_id)
                logger.info(f"Auto-generated {variant_result.get('count', 0)} variants after randomize")
        except Exception as e:
            logger.error(f"Auto variant generation failed (non-fatal): {e}")
            # Don't fail the randomize if variant generation fails
        
        # Send WebSocket notification
        try:
            await connection_manager.broadcast_playlist_update(playlist.to_dict())
        except Exception as e:
            logger.error(f"Failed to broadcast playlist update: {e}")
        
        return {
            "success": True,
            "message": "Playlist randomized successfully",
            "new_sequence": playlist.sequence,
            "computed_sequence": playlist.computed_sequence
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Randomize playlist error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to randomize playlist"
        )

@router.get("/{playlist_id}/images")
async def get_playlist_images(
    playlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get playlist images in order"""
    try:
        playlist_service = PlaylistService(db)
        images = playlist_service.get_playlist_images_ordered(playlist_id)
        
        return {
            "success": True,
            "images": [image.to_dict() for image in images],
            "count": len(images)
        }
        
    except Exception as e:
        logger.error(f"Get playlist images error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve playlist images"
        )

@router.get("/{playlist_id}/images/manifest")
async def get_playlist_images_manifest(
    playlist_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Get lightweight image manifest for cache prefetching (public endpoint for display devices)
    
    Returns only essential metadata for each image in the playlist,
    optimized for client-side caching in IndexedDB.
    
    Response includes: id, url, filename, mime_type, file_size
    """
    try:
        # Check if playlist exists
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Playlist {playlist_id} not found"
            )
        
        # Get ordered images
        playlist_service = PlaylistService(db)
        images = playlist_service.get_playlist_images_ordered(playlist_id)
        
        # Build lightweight manifest (using relative URLs - frontend will construct full URLs)
        manifest = []
        for image in images:
            # Use relative URL path - frontend can prepend server base URL
            image_url = f"/uploads/images/{image.filename}"
            
            manifest.append({
                "id": str(image.id),  # String for IndexedDB key
                "url": image_url,
                "filename": image.filename,
                "mime_type": image.mime_type or "image/jpeg",
                "file_size": image.file_size or 0,
            })
        
        logger.info(
            f"Generated manifest for playlist {playlist_id} ({playlist.name}): "
            f"{len(manifest)} images, "
            f"~{sum(img['file_size'] for img in manifest) / (1024*1024):.1f}MB total"
        )
        
        return {
            "success": True,
            "playlist_id": playlist_id,
            "playlist_name": playlist.name,
            "manifest": manifest,
            "count": len(manifest),
            "total_size": sum(img["file_size"] for img in manifest),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"MANIFEST ERROR: {e}")
        print(f"TRACEBACK:\n{error_details}")
        logger.error(f"Get playlist manifest error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve playlist manifest: {str(e)}"
        )

@router.get("/stats/overview")
async def get_playlist_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get playlist statistics"""
    try:
        playlist_service = PlaylistService(db)
        stats = playlist_service.get_playlist_statistics()
        
        return {
            "success": True,
            "statistics": stats
        }
        
    except Exception as e:
        logger.error(f"Get playlist statistics error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve playlist statistics"
        )

# Playlist Variant Endpoints

@router.post("/{playlist_id}/generate-variants")
async def generate_playlist_variants(
    playlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate resolution-specific variants for a playlist"""
    try:
        # Check if playlist exists
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Playlist not found"
            )
        
        # Get configured display sizes for diagnostics
        from services.image_storage_service import image_storage_service
        configured_sizes = image_storage_service._load_display_sizes()
        logger.info(f"🎯 Variant generation request for '{playlist.name}'")
        logger.info(f"📐 Configured display sizes from database: {configured_sizes}")
        
        # Generate variants
        variant_service = PlaylistVariantService(db)
        variants = variant_service.generate_variants_for_playlist(playlist_id)
        
        # Get generation errors if any
        generation_errors = getattr(variant_service, '_last_generation_errors', [])
        
        # Enhanced response with diagnostic info
        return {
            "success": True,
            "message": f"Generated {len(variants)} variants for playlist {playlist.name}",
            "playlist_id": playlist_id,
            "playlist_name": playlist.name,
            "variants": [variant.to_dict() for variant in variants],
            "count": len(variants),
            "diagnostic": {
                "configured_display_sizes": [f"{w}x{h}" for w, h in configured_sizes],
                "configured_count": len(configured_sizes),
                "variants_generated": len(variants),
                "errors": generation_errors
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Generate playlist variants error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate playlist variants: {str(e)}"
        )

@router.post("/generate-all-variants")
async def generate_all_playlist_variants(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Queue all playlist images for variant regeneration using Celery or BackgroundTasks"""
    try:
        logger.info("🔄 Queueing playlist images for variant regeneration...")
        
        # Get all unique images that are in playlists
        images_in_playlists = db.query(Image).filter(Image.playlist_id.isnot(None)).distinct().all()
        
        if not images_in_playlists:
            return {
                "message": "No playlist images found to regenerate",
                "data": {"total_images": 0, "queued": 0},
                "status_code": 200
            }
        
        use_celery = os.getenv('USE_CELERY', 'true').lower() == 'true'
        
        # Reset variant status for all playlist images
        for image in images_in_playlists:
            image.variant_status = 'pending'
            image.processing_status = 'pending'
            image.processing_error = None
            image.processing_attempts = 0
            image.last_processing_attempt = None
        
        db.commit()
        
        # Queue tasks using Celery or fallback
        queued_count = 0
        if use_celery:
            try:
                from tasks.image_processing import process_variants
                for image in images_in_playlists:
                    process_variants.apply_async(
                        args=[image.id, image.filename, 1],
                        queue='low_priority'  # Bulk regeneration is low priority
                    )
                    queued_count += 1
                logger.info(f"✅ Queued {queued_count} playlist images in Celery (low priority queue)")
            except Exception as celery_error:
                logger.warning(f"Celery unavailable, falling back to BackgroundTasks: {celery_error}")
                from api.images import _process_variants_for_image
                for image in images_in_playlists:
                    background_tasks.add_task(_process_variants_for_image, image.id, image.filename, 1)
                    queued_count += 1
                logger.info(f"✅ Queued {queued_count} playlist images in BackgroundTasks (fallback)")
        else:
            from api.images import _process_variants_for_image
            for image in images_in_playlists:
                background_tasks.add_task(_process_variants_for_image, image.id, image.filename, 1)
                queued_count += 1
            logger.info(f"✅ Queued {queued_count} playlist images in BackgroundTasks")
        
        return {
            "message": f"Queued {queued_count} playlist images for variant regeneration",
            "data": {
                "total_images": len(images_in_playlists),
                "queued": queued_count,
                "status": "queued",
                "using_celery": use_celery
            },
            "status_code": 200
        }
        
    except Exception as e:
        logger.error(f"Generate all playlist variants error: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to queue playlist variant regeneration: {str(e)}"
        )

@router.get("/{playlist_id}/variants")
async def get_playlist_variants(
    playlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all variants for a playlist"""
    try:
        from models.playlist_variant import PlaylistVariant
        
        # Check if playlist exists
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Playlist not found"
            )
        
        # Get variants
        variants = db.query(PlaylistVariant).filter(PlaylistVariant.playlist_id == playlist_id).all()
        
        return {
            "message": f"Retrieved {len(variants)} variants for playlist {playlist.name}",
            "playlist_id": playlist_id,
            "variants": [variant.to_dict() for variant in variants],
            "count": len(variants)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get playlist variants error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve playlist variants"
        )

@router.get("/{playlist_id}/smart")
async def get_playlist_smart(
    playlist_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Get playlist optimized for device resolution (public endpoint for display devices)"""
    try:
        from models.playlist_variant import PlaylistVariant
        from services.database_config_service import DatabaseConfigService
        
        # Get global show_image_info setting
        config_service = DatabaseConfigService(db)
        show_image_info = config_service.get_setting("show_image_info", False)
        
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
        
        # Get device resolution
        device_width = device.screen_width or 1920
        device_height = device.screen_height or 1080
        device_pixel_ratio = float(device.device_pixel_ratio or "1.0")
        
        # Get all available variants for this playlist
        all_variants = db.query(PlaylistVariant).filter(PlaylistVariant.playlist_id == playlist_id).all()
        available_variants_list = [
            {
                "id": v.id,
                "type": v.variant_type.value,
                "target": f"{v.target_width}x{v.target_height}",
                "image_count": v.image_count
            } for v in all_variants
        ]
        
        # Log variant selection process
        logger.info(f"Smart playlist request for playlist {playlist_id}, device: {device_token[:8]}...")
        logger.info(f"Device resolution: {device_width}x{device_height} (DPR: {device_pixel_ratio})")
        logger.info(f"Available variants: {len(all_variants)}")
        for v in all_variants:
            logger.info(f"  - {v.variant_type.value}: {v.target_width}x{v.target_height} ({v.image_count} images)")
        
        # Get best variant for this device
        variant_service = PlaylistVariantService(db)
        best_variant = variant_service.get_best_variant_for_device(
            playlist_id, device_width, device_height, device_pixel_ratio
        )
        
        if not best_variant:
            # Fallback to original playlist
            playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
            if not playlist:
                raise HTTPException(status_code=404, detail="Playlist not found")
            
            logger.warning(f"No variant found for {device_width}x{device_height}, using original")
            
            # Add global show_image_info setting to playlist
            playlist_dict = playlist.to_dict()
            playlist_dict["show_image_info"] = show_image_info
            
            return {
                "message": "Using original playlist (no variants available)",
                "playlist": playlist_dict,
                "variant_type": "original",
                "device_resolution": f"{device_width}x{device_height}",
                "effective_resolution": f"{int(device_width * device_pixel_ratio)}x{int(device_height * device_pixel_ratio)}",
                "available_variants": available_variants_list
            }
        
        # Get playlist details
        playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
        
        # Create optimized playlist response
        optimized_playlist = playlist.to_dict()
        optimized_playlist["sequence"] = best_variant.optimized_sequence
        optimized_playlist["image_count"] = best_variant.image_count
        optimized_playlist["show_image_info"] = show_image_info  # Add global setting
        
        logger.info(f"Selected variant: {best_variant.variant_type.value} ({best_variant.target_width}x{best_variant.target_height})")
        
        return {
            "message": f"Using {best_variant.variant_type.value} variant for device",
            "playlist": optimized_playlist,
            "variant": best_variant.to_dict(),
            "device_resolution": f"{device_width}x{device_height}",
            "effective_resolution": f"{int(device_width * device_pixel_ratio)}x{int(device_height * device_pixel_ratio)}",
            "available_variants": available_variants_list
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get smart playlist error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve optimized playlist"
        )


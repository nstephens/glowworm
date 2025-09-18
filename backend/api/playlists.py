from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging

from models import get_db, Playlist
from models.user import User
from models.display_device import DisplayDevice, DeviceStatus
from utils.middleware import get_current_user
from services.playlist_service import PlaylistService
from services.display_device_service import DisplayDeviceService
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

class PlaylistReorderRequest(BaseModel):
    image_ids: List[int]

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
            display_mode=update_data.display_mode
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
    """Reorder images in playlist"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        playlist_service = PlaylistService(db)
        success = playlist_service.reorder_playlist(playlist_id, reorder_data.image_ids)
        
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
                "message": "Playlist reordered successfully"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to reorder playlist"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reorder playlist error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reorder playlist"
        )

@router.post("/{playlist_id}/randomize")
async def randomize_playlist(
    request: Request,
    playlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Randomize the order of images in playlist"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        playlist_service = PlaylistService(db)
        success = playlist_service.randomize_playlist(playlist_id)
        
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
                "message": "Playlist randomized successfully"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to randomize playlist"
            )
        
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


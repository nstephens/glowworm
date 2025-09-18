from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
from pydantic import BaseModel

from models import get_db, Album
from models.user import User
from utils.middleware import require_auth
from services.album_service import AlbumService
from utils.csrf import csrf_protection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/albums", tags=["albums"])

class AlbumCreateRequest(BaseModel):
    name: str

@router.post("/")
async def create_album(
    request: Request,
    album_data: AlbumCreateRequest,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Create a new album"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        album_service = AlbumService(db)
        
        # Check if album with same name already exists
        existing_album = album_service.get_album_by_name(album_data.name)
        if existing_album:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Album with this name already exists"
            )
        
        album = album_service.create_album(album_data.name)
        
        return {
            "message": "Album created successfully",
            "data": album.to_dict(),
            "status_code": 200
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create album error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create album"
        )

@router.get("/")
async def get_albums(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get all albums"""
    try:
        album_service = AlbumService(db)
        albums = album_service.get_all_albums()
        
        return {
            "message": "Albums retrieved successfully",
            "data": [album.to_dict() for album in albums],
            "status_code": 200
        }
        
    except Exception as e:
        logger.error(f"Get albums error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve albums"
        )

@router.get("/{album_id}")
async def get_album(
    album_id: int,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get a specific album by ID"""
    try:
        album_service = AlbumService(db)
        album = album_service.get_album_by_id(album_id)
        
        if not album:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Album not found"
            )
        
        return {
            "message": "Album retrieved successfully",
            "data": album.to_dict(),
            "status_code": 200
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get album error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve album"
        )

@router.put("/{album_id}")
async def update_album(
    request: Request,
    album_id: int,
    name: str,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Update album name"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        album_service = AlbumService(db)
        
        # Check if album exists
        album = album_service.get_album_by_id(album_id)
        if not album:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Album not found"
            )
        
        # Check if new name already exists
        existing_album = album_service.get_album_by_name(name)
        if existing_album and existing_album.id != album_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Album with this name already exists"
            )
        
        updated_album = album_service.update_album(album_id, name)
        
        return {
            "message": "Album updated successfully",
            "data": updated_album.to_dict(),
            "status_code": 200
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update album error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update album"
        )

@router.delete("/{album_id}")
async def delete_album(
    request: Request,
    album_id: int,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Delete an album"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        album_service = AlbumService(db)
        
        # Check if album exists
        album = album_service.get_album_by_id(album_id)
        if not album:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Album not found"
            )
        
        success = album_service.delete_album(album_id)
        
        if success:
            return {
                "message": "Album deleted successfully",
                "data": None,
                "status_code": 200
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete album"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete album error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete album"
        )

@router.post("/{album_id}/images/{image_id}")
async def add_image_to_album(
    request: Request,
    album_id: int,
    image_id: int,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Add image to album"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        album_service = AlbumService(db)
        success = album_service.add_image_to_album(album_id, image_id)
        
        if success:
            return {
                "message": "Image added to album successfully",
                "data": None,
                "status_code": 200
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to add image to album"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add image to album error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add image to album"
        )

@router.delete("/{album_id}/images/{image_id}")
async def remove_image_from_album(
    request: Request,
    album_id: int,
    image_id: int,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Remove image from album"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        album_service = AlbumService(db)
        success = album_service.remove_image_from_album(album_id, image_id)
        
        if success:
            return {
                "message": "Image removed from album successfully",
                "data": None,
                "status_code": 200
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to remove image from album"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Remove image from album error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove image from album"
        )

@router.get("/stats/overview")
async def get_album_statistics(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get album statistics"""
    try:
        album_service = AlbumService(db)
        stats = album_service.get_album_statistics()
        
        return {
            "message": "Album statistics retrieved successfully",
            "data": stats,
            "status_code": 200
        }
        
    except Exception as e:
        logger.error(f"Get album statistics error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve album statistics"
        )

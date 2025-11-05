"""
Cache management API endpoints.
Provides access to cache statistics and management functions.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any
import logging

from models import get_db
from models.user import User
from utils.middleware import require_auth
from services.caching_service import (
    get_cache_stats, 
    clear_cache, 
    invalidate_cache_pattern,
    cache_service
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cache", tags=["cache-management"])

@router.get("/stats")
async def get_cache_statistics(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get cache statistics and performance metrics"""
    try:
        stats = get_cache_stats()
        
        return {
            "success": True,
            "data": stats,
            "message": "Cache statistics retrieved successfully"
        }
        
    except Exception as e:
        logger.error(f"Get cache statistics error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve cache statistics"
        )

@router.post("/clear")
async def clear_all_cache(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Clear all cache entries (admin only)"""
    try:
        # Only allow super admins to clear cache
        if current_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only super admins can clear cache"
            )
        
        clear_cache()
        
        return {
            "success": True,
            "message": "All cache entries cleared successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Clear cache error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear cache"
        )

@router.post("/invalidate")
async def invalidate_cache_pattern_endpoint(
    pattern: str,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Invalidate cache entries matching a pattern (admin only)"""
    try:
        # Only allow super admins to invalidate cache
        if current_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only super admins can invalidate cache"
            )
        
        invalidated_count = invalidate_cache_pattern(pattern)
        
        return {
            "success": True,
            "data": {
                "pattern": pattern,
                "invalidated_count": invalidated_count
            },
            "message": f"Invalidated {invalidated_count} cache entries matching pattern '{pattern}'"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Invalidate cache pattern error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to invalidate cache pattern"
        )

@router.post("/cleanup")
async def cleanup_expired_cache(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Clean up expired cache entries"""
    try:
        # Only allow super admins to cleanup cache
        if current_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only super admins can cleanup cache"
            )
        
        cleaned_count = cache_service.cleanup_expired()
        
        return {
            "success": True,
            "data": {
                "cleaned_count": cleaned_count
            },
            "message": f"Cleaned up {cleaned_count} expired cache entries"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cleanup expired cache error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cleanup expired cache entries"
        )

@router.get("/entries")
async def list_cache_entries(
    limit: int = 50,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """List cache entries with metadata (admin only)"""
    try:
        # Only allow super admins to list cache entries
        if current_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only super admins can list cache entries"
            )
        
        stats = get_cache_stats()
        entries = stats.get('entries', {})
        
        # Limit the number of entries returned
        limited_entries = dict(list(entries.items())[:limit])
        
        return {
            "success": True,
            "data": {
                "entries": limited_entries,
                "total_entries": len(entries),
                "returned_count": len(limited_entries)
            },
            "message": f"Retrieved {len(limited_entries)} cache entries"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"List cache entries error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list cache entries"
        )

@router.post("/invalidate/image")
async def invalidate_image_cache(
    image_id: int = None,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Invalidate image-related cache entries"""
    try:
        # Only allow super admins to invalidate cache
        if current_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only super admins can invalidate cache"
            )
        
        from services.caching_service import invalidate_image_cache as invalidate_img_cache
        invalidated_count = invalidate_img_cache(image_id)
        
        return {
            "success": True,
            "data": {
                "image_id": image_id,
                "invalidated_count": invalidated_count
            },
            "message": f"Invalidated {invalidated_count} image-related cache entries"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Invalidate image cache error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to invalidate image cache"
        )

@router.post("/invalidate/playlist")
async def invalidate_playlist_cache(
    playlist_id: int = None,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Invalidate playlist-related cache entries"""
    try:
        # Only allow super admins to invalidate cache
        if current_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only super admins can invalidate cache"
            )
        
        from services.caching_service import invalidate_playlist_cache as invalidate_pl_cache
        invalidated_count = invalidate_pl_cache(playlist_id)
        
        return {
            "success": True,
            "data": {
                "playlist_id": playlist_id,
                "invalidated_count": invalidated_count
            },
            "message": f"Invalidated {invalidated_count} playlist-related cache entries"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Invalidate playlist cache error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to invalidate playlist cache"
        )

@router.post("/invalidate/album")
async def invalidate_album_cache(
    album_id: int = None,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Invalidate album-related cache entries"""
    try:
        # Only allow super admins to invalidate cache
        if current_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only super admins can invalidate cache"
            )
        
        from services.caching_service import invalidate_album_cache as invalidate_alb_cache
        invalidated_count = invalidate_alb_cache(album_id)
        
        return {
            "success": True,
            "data": {
                "album_id": album_id,
                "invalidated_count": invalidated_count
            },
            "message": f"Invalidated {invalidated_count} album-related cache entries"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Invalidate album cache error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to invalidate album cache"
        )
















from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import logging

from models import get_db
from services.slideshow_preload_service import slideshow_preload_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/slideshow", tags=["slideshow-preload"])

@router.post("/preload/{playlist_id}")
async def preload_playlist_images(
    playlist_id: int,
    formats: List[str] = ["webp", "avif"],
    db: Session = Depends(get_db)
):
    """Preload images for a specific playlist for slideshow performance"""
    try:
        result = await slideshow_preload_service.preload_playlist_images(playlist_id, formats)
        
        return {
            "message": "Preload request processed",
            "data": result,
            "status_code": 200
        }
        
    except Exception as e:
        logger.error(f"Preload playlist images error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to preload playlist images"
        )

@router.post("/preload/queue/{playlist_id}")
async def queue_preload_request(
    playlist_id: int,
    formats: List[str] = ["webp", "avif"],
    priority: str = "normal"
):
    """Queue a preload request for background processing"""
    try:
        await slideshow_preload_service.queue_preload(playlist_id, formats, priority)
        
        return {
            "message": "Preload request queued successfully",
            "data": {
                "playlist_id": playlist_id,
                "formats": formats,
                "priority": priority
            },
            "status_code": 200
        }
        
    except Exception as e:
        logger.error(f"Queue preload request error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to queue preload request"
        )

@router.get("/preload/status/{playlist_id}")
async def get_preload_status(playlist_id: int):
    """Get preload status for a specific playlist"""
    try:
        status = slideshow_preload_service.get_preload_status(playlist_id)
        
        if not status:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No preload status found for this playlist"
            )
        
        return {
            "message": "Preload status retrieved successfully",
            "data": status,
            "status_code": 200
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get preload status error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve preload status"
        )

@router.get("/preload/status")
async def get_all_preload_status():
    """Get all preload statuses"""
    try:
        status = slideshow_preload_service.get_all_preload_status()
        
        return {
            "message": "All preload statuses retrieved successfully",
            "data": status,
            "status_code": 200
        }
        
    except Exception as e:
        logger.error(f"Get all preload status error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve preload statuses"
        )

@router.get("/preload/recommendations/{playlist_id}")
async def get_preload_recommendations(
    playlist_id: int,
    db: Session = Depends(get_db)
):
    """Get preload recommendations for a playlist"""
    try:
        recommendations = slideshow_preload_service.get_playlist_preload_recommendations(playlist_id, db)
        
        return {
            "message": "Preload recommendations retrieved successfully",
            "data": recommendations,
            "status_code": 200
        }
        
    except Exception as e:
        logger.error(f"Get preload recommendations error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve preload recommendations"
        )

@router.delete("/preload/status/{playlist_id}")
async def clear_preload_status(playlist_id: int):
    """Clear preload status for a specific playlist"""
    try:
        slideshow_preload_service.clear_preload_status(playlist_id)
        
        return {
            "message": "Preload status cleared successfully",
            "data": None,
            "status_code": 200
        }
        
    except Exception as e:
        logger.error(f"Clear preload status error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear preload status"
        )

@router.delete("/preload/status")
async def clear_all_preload_status():
    """Clear all preload statuses"""
    try:
        slideshow_preload_service.clear_all_preload_status()
        
        return {
            "message": "All preload statuses cleared successfully",
            "data": None,
            "status_code": 200
        }
        
    except Exception as e:
        logger.error(f"Clear all preload status error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear all preload statuses"
        )

@router.get("/preload/cache/stats")
async def get_preload_cache_stats():
    """Get preload cache statistics"""
    try:
        stats = slideshow_preload_service.get_preload_cache_stats()
        
        return {
            "message": "Preload cache statistics retrieved successfully",
            "data": stats,
            "status_code": 200
        }
        
    except Exception as e:
        logger.error(f"Get preload cache stats error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve preload cache statistics"
        )

@router.post("/preload/worker/start")
async def start_preload_worker():
    """Start the background preload worker"""
    try:
        await slideshow_preload_service.start_preload_worker()
        
        return {
            "message": "Preload worker started successfully",
            "data": None,
            "status_code": 200
        }
        
    except Exception as e:
        logger.error(f"Start preload worker error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start preload worker"
        )

@router.post("/preload/worker/stop")
async def stop_preload_worker():
    """Stop the background preload worker"""
    try:
        await slideshow_preload_service.stop_preload_worker()
        
        return {
            "message": "Preload worker stopped successfully",
            "data": None,
            "status_code": 200
        }
        
    except Exception as e:
        logger.error(f"Stop preload worker error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to stop preload worker"
        )















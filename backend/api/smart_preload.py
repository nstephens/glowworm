from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import logging

from models.database import get_db
from services.smart_preload_service import smart_preload_service, PreloadPriority
from utils.middleware import require_admin, get_current_user
from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/smart-preload", tags=["smart-preload"])

# Pydantic models
class SmartPreloadRequest(BaseModel):
    playlist_id: int
    current_image_index: int = 0
    slide_duration: int = 5
    formats: List[str] = ["webp", "avif"]

class PreloadStatusResponse(BaseModel):
    image_id: Optional[int] = None
    status: str
    priority: Optional[str] = None
    retry_count: Optional[int] = None
    error: Optional[str] = None
    completed_at: Optional[str] = None
    processing_time: Optional[float] = None

class OverallStatusResponse(BaseModel):
    worker_running: bool
    queue_size: int
    active_tasks: int
    completed_tasks: int
    failed_tasks: int
    memory_stats: Dict[str, Any]
    stats: Dict[str, Any]
    max_concurrent_tasks: int
    memory_threshold_percent: float

class SlideshowTimingUpdate(BaseModel):
    playlist_id: int
    current_index: int
    slide_duration: int

@router.post("/start")
async def start_smart_preload_worker():
    """Start the smart preload worker"""
    try:
        await smart_preload_service.start_worker()
        return {"message": "Smart preload worker started successfully"}
    except Exception as e:
        logger.error(f"Failed to start smart preload worker: {e}")
        raise HTTPException(status_code=500, detail="Failed to start worker")

@router.post("/stop")
async def stop_smart_preload_worker():
    """Stop the smart preload worker"""
    try:
        await smart_preload_service.stop_worker()
        return {"message": "Smart preload worker stopped successfully"}
    except Exception as e:
        logger.error(f"Failed to stop smart preload worker: {e}")
        raise HTTPException(status_code=500, detail="Failed to stop worker")

@router.post("/preload-playlist")
async def preload_playlist_smart(
    request: SmartPreloadRequest,
    background_tasks: BackgroundTasks
):
    """Start smart preloading for a playlist"""
    try:
        result = await smart_preload_service.preload_playlist_smart(
            playlist_id=request.playlist_id,
            current_image_index=request.current_image_index,
            slide_duration=request.slide_duration,
            formats=request.formats
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to start smart preload: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start preload: {str(e)}")

@router.get("/status", response_model=OverallStatusResponse)
async def get_overall_status():
    """Get overall smart preload status"""
    try:
        status = smart_preload_service.get_preload_status()
        return OverallStatusResponse(**status)
    except Exception as e:
        logger.error(f"Failed to get overall status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get status")

@router.get("/status/{image_id}", response_model=PreloadStatusResponse)
async def get_image_status(image_id: int):
    """Get preload status for a specific image"""
    try:
        status = smart_preload_service.get_preload_status(image_id)
        return PreloadStatusResponse(**status)
    except Exception as e:
        logger.error(f"Failed to get image status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get image status")

@router.post("/update-timing")
async def update_slideshow_timing(request: SlideshowTimingUpdate):
    """Update slideshow timing for optimization"""
    try:
        smart_preload_service.update_slideshow_timing(
            playlist_id=request.playlist_id,
            current_index=request.current_index,
            slide_duration=request.slide_duration
        )
        
        return {
            "message": "Slideshow timing updated successfully",
            "playlist_id": request.playlist_id,
            "current_index": request.current_index,
            "slide_duration": request.slide_duration
        }
        
    except Exception as e:
        logger.error(f"Failed to update slideshow timing: {e}")
        raise HTTPException(status_code=500, detail="Failed to update timing")

@router.get("/timing/{playlist_id}")
async def get_slideshow_timing(playlist_id: int):
    """Get current slideshow timing for a playlist"""
    try:
        timing = smart_preload_service.get_slideshow_timing(playlist_id)
        if timing:
            return timing
        else:
            return {
                "playlist_id": playlist_id,
                "message": "No timing data found for this playlist"
            }
    except Exception as e:
        logger.error(f"Failed to get slideshow timing: {e}")
        raise HTTPException(status_code=500, detail="Failed to get timing")

@router.post("/clear-completed")
async def clear_completed_tasks(older_than_hours: int = 1):
    """Clear completed tasks older than specified hours"""
    try:
        cleared_count = smart_preload_service.clear_completed_tasks(older_than_hours)
        return {
            "message": f"Cleared {cleared_count} completed tasks",
            "cleared_count": cleared_count,
            "older_than_hours": older_than_hours
        }
    except Exception as e:
        logger.error(f"Failed to clear completed tasks: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear tasks")

@router.get("/memory-stats")
async def get_memory_stats():
    """Get detailed memory statistics"""
    try:
        memory_stats = smart_preload_service._get_memory_stats()
        return {
            "total_memory_mb": memory_stats.total_memory // (1024 * 1024),
            "available_memory_mb": memory_stats.available_memory // (1024 * 1024),
            "used_memory_mb": memory_stats.used_memory // (1024 * 1024),
            "used_memory_percent": memory_stats.memory_percent,
            "cache_memory_mb": memory_stats.cache_memory // (1024 * 1024),
            "memory_pressure": memory_stats.memory_percent > smart_preload_service.memory_threshold_percent
        }
    except Exception as e:
        logger.error(f"Failed to get memory stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get memory stats")

@router.post("/configure")
async def configure_preload_service(
    max_concurrent_tasks: Optional[int] = None,
    memory_threshold_percent: Optional[float] = None,
    max_cache_size_mb: Optional[int] = None,
    current_user: User = Depends(require_admin)
):
    """Configure smart preload service settings (admin only)"""
    try:
        if max_concurrent_tasks is not None:
            smart_preload_service.max_concurrent_tasks = max_concurrent_tasks
        
        if memory_threshold_percent is not None:
            smart_preload_service.memory_threshold_percent = memory_threshold_percent
        
        if max_cache_size_mb is not None:
            smart_preload_service.max_cache_size_mb = max_cache_size_mb
        
        return {
            "message": "Configuration updated successfully",
            "max_concurrent_tasks": smart_preload_service.max_concurrent_tasks,
            "memory_threshold_percent": smart_preload_service.memory_threshold_percent,
            "max_cache_size_mb": smart_preload_service.max_cache_size_mb
        }
        
    except Exception as e:
        logger.error(f"Failed to configure preload service: {e}")
        raise HTTPException(status_code=500, detail="Failed to update configuration")

@router.get("/stats")
async def get_preload_stats():
    """Get preload statistics"""
    try:
        return {
            "preload_stats": smart_preload_service.preload_stats,
            "current_config": {
                "max_concurrent_tasks": smart_preload_service.max_concurrent_tasks,
                "memory_threshold_percent": smart_preload_service.memory_threshold_percent,
                "max_cache_size_mb": smart_preload_service.max_cache_size_mb
            }
        }
    except Exception as e:
        logger.error(f"Failed to get preload stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get stats")

@router.post("/emergency-stop")
async def emergency_stop_preload():
    """Emergency stop all preload operations"""
    try:
        # Stop the worker
        await smart_preload_service.stop_worker()
        
        # Clear all queues and tasks
        while not smart_preload_service.preload_queue.empty():
            try:
                smart_preload_service.preload_queue.get_nowait()
            except:
                break
        
        # Clear active tasks
        smart_preload_service.active_tasks.clear()
        
        return {
            "message": "Emergency stop completed",
            "active_tasks_cleared": len(smart_preload_service.active_tasks),
            "queue_cleared": True
        }
        
    except Exception as e:
        logger.error(f"Failed to emergency stop: {e}")
        raise HTTPException(status_code=500, detail="Failed to emergency stop")





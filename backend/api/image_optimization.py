from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional
import logging
from pathlib import Path

from models import get_db, Image
from services.image_service import ImageService
from services.image_storage_service import image_storage_service
from services.image_optimization_service import image_optimization_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/images", tags=["image-optimization"])

@router.get("/{image_id}/optimized")
async def get_optimized_image(
    image_id: int,
    request: Request,
    width: Optional[int] = None,
    height: Optional[int] = None,
    quality: int = 85,
    format: str = "auto",
    db: Session = Depends(get_db)
):
    """Get optimized image with format detection and caching for home network"""
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
        
        # Read original image
        with open(file_path, 'rb') as f:
            image_bytes = f.read()
        
        # Get Accept header for format detection
        accept_header = request.headers.get("Accept", "")
        
        # Determine original format
        original_format = image.mime_type.split('/')[-1] if image.mime_type else 'jpeg'
        
        # Get optimized image
        optimized_bytes, content_type, cache_headers = await image_optimization_service.get_optimized_image(
            image_bytes=image_bytes,
            filename=image.filename,
            uploaded_at=image.uploaded_at,
            accept_header=accept_header,
            width=width,
            height=height,
            quality=quality,
            original_format=original_format
        )
        
        # Add content type to headers
        cache_headers["Content-Type"] = content_type
        
        return Response(
            content=optimized_bytes,
            headers=cache_headers,
            media_type=content_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get optimized image error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve optimized image"
        )

@router.post("/preload")
async def preload_images(
    image_ids: list[int],
    formats: list[str] = ["webp", "avif"],
    db: Session = Depends(get_db)
):
    """Preload images for slideshow performance"""
    try:
        image_service = ImageService(db)
        image_paths = []
        
        # Get image paths
        for image_id in image_ids:
            image = image_service.get_image_by_id(image_id)
            if image:
                file_path = image_storage_service.get_image_path(image.filename)
                if file_path and file_path.exists():
                    image_paths.append(str(file_path))
        
        if not image_paths:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No valid images found for preloading"
            )
        
        # Preload images
        preload_results = image_optimization_service.preload_images(image_paths, formats)
        
        return {
            "message": "Images preloaded successfully",
            "data": {
                "preloaded_count": sum(1 for success in preload_results.values() if success),
                "total_requested": len(image_paths),
                "results": preload_results
            },
            "status_code": 200
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Preload images error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to preload images"
        )

@router.get("/preload/{filename}/{format}")
async def get_preloaded_image(
    filename: str,
    format: str,
    db: Session = Depends(get_db)
):
    """Get preloaded image from cache"""
    try:
        # Get preloaded image
        cached_data = image_optimization_service.get_preloaded_image(filename, format)
        
        if not cached_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found in preload cache"
            )
        
        optimized_bytes, content_type = cached_data
        
        # Generate cache headers
        cache_headers = {
            "Cache-Control": "public, max-age=3600",  # 1 hour for preloaded content
            "Content-Type": content_type,
            "X-Cache": "HIT"
        }
        
        return Response(
            content=optimized_bytes,
            headers=cache_headers,
            media_type=content_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get preloaded image error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve preloaded image"
        )

@router.get("/cache/stats")
async def get_cache_stats():
    """Get image optimization cache statistics"""
    try:
        stats = image_optimization_service.get_cache_stats()
        
        return {
            "message": "Cache statistics retrieved successfully",
            "data": stats,
            "status_code": 200
        }
        
    except Exception as e:
        logger.error(f"Get cache stats error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve cache statistics"
        )

@router.post("/cache/clear")
async def clear_cache():
    """Clear image optimization cache"""
    try:
        image_optimization_service.clear_preload_cache()
        
        return {
            "message": "Cache cleared successfully",
            "data": None,
            "status_code": 200
        }
        
    except Exception as e:
        logger.error(f"Clear cache error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear cache"
        )
















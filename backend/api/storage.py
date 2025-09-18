from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import logging

from models import get_db
from models.user import User
from utils.middleware import get_current_user
from services.storage_efficiency_service import StorageEfficiencyService
from utils.csrf import csrf_protection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/storage", tags=["storage"])

@router.get("/statistics")
async def get_storage_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get comprehensive storage statistics"""
    try:
        storage_service = StorageEfficiencyService(db)
        stats = storage_service.get_storage_statistics()
        
        return {
            "success": True,
            "statistics": stats
        }
        
    except Exception as e:
        logger.error(f"Get storage statistics error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve storage statistics"
        )

@router.get("/duplicates")
async def find_duplicate_files(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Find duplicate files based on content hash"""
    try:
        storage_service = StorageEfficiencyService(db)
        duplicates = storage_service.find_duplicate_files()
        
        # Format response
        formatted_duplicates = []
        for duplicate_group in duplicates:
            group_data = []
            for item in duplicate_group:
                group_data.append({
                    'image': item['image'].to_dict(),
                    'file_path': str(item['file_path']),
                    'hash': item['hash']
                })
            formatted_duplicates.append(group_data)
        
        return {
            "success": True,
            "duplicates": formatted_duplicates,
            "duplicate_groups": len(duplicates)
        }
        
    except Exception as e:
        logger.error(f"Find duplicate files error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to find duplicate files"
        )

@router.get("/similar")
async def find_similar_images(
    threshold: float = 0.95,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Find similar images based on file size and dimensions"""
    try:
        storage_service = StorageEfficiencyService(db)
        similar_groups = storage_service.find_similar_images(threshold)
        
        # Format response
        formatted_similar = []
        for group in similar_groups:
            group_data = [image.to_dict() for image in group]
            formatted_similar.append(group_data)
        
        return {
            "success": True,
            "similar_images": formatted_similar,
            "similar_groups": len(similar_groups)
        }
        
    except Exception as e:
        logger.error(f"Find similar images error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to find similar images"
        )

@router.post("/merge-duplicates")
async def merge_duplicate_images(
    request: Request,
    duplicate_group: List[int],
    keep_image_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Merge duplicate images by keeping one and updating references"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        storage_service = StorageEfficiencyService(db)
        
        # Validate that keep_image_id is in the duplicate group
        if keep_image_id not in duplicate_group:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Keep image ID must be in the duplicate group"
            )
        
        # Get the duplicate group data
        all_duplicates = storage_service.find_duplicate_files()
        target_group = None
        
        for group in all_duplicates:
            group_ids = [item['image'].id for item in group]
            if set(duplicate_group).issubset(set(group_ids)):
                target_group = group
                break
        
        if not target_group:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Duplicate group not found or invalid"
            )
        
        # Merge duplicates
        success = storage_service.merge_duplicate_images(target_group, keep_image_id)
        
        if success:
            return {
                "success": True,
                "message": "Duplicate images merged successfully"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to merge duplicate images"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Merge duplicate images error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to merge duplicate images"
        )

@router.post("/optimize")
async def optimize_storage(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Run storage optimization analysis"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        storage_service = StorageEfficiencyService(db)
        results = storage_service.optimize_storage()
        
        return {
            "success": True,
            "optimization_results": results
        }
        
    except Exception as e:
        logger.error(f"Optimize storage error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to optimize storage"
        )

@router.post("/cleanup-orphaned")
async def cleanup_orphaned_files(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove orphaned files that don't have database records"""
    try:
        # CSRF protection
        csrf_protection.require_csrf_token(request)
        
        storage_service = StorageEfficiencyService(db)
        results = storage_service.cleanup_orphaned_files()
        
        return {
            "success": True,
            "cleanup_results": results
        }
        
    except Exception as e:
        logger.error(f"Cleanup orphaned files error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cleanup orphaned files"
        )

@router.get("/efficiency-report")
async def get_efficiency_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get comprehensive storage efficiency report"""
    try:
        storage_service = StorageEfficiencyService(db)
        
        # Get all statistics
        stats = storage_service.get_storage_statistics()
        duplicates = storage_service.find_duplicate_files()
        similar = storage_service.find_similar_images()
        
        # Calculate efficiency metrics
        total_images = stats.get('total_images', 0)
        total_size = stats.get('total_size_bytes', 0)
        potential_savings = stats.get('potential_savings_bytes', 0)
        
        efficiency_score = stats.get('efficiency_score', 100)
        
        # Generate recommendations
        recommendations = []
        
        if len(duplicates) > 0:
            recommendations.append({
                'type': 'duplicates',
                'priority': 'high',
                'message': f'Found {len(duplicates)} groups of duplicate files that could be merged to save space',
                'action': 'merge_duplicates'
            })
        
        if len(similar) > 0:
            recommendations.append({
                'type': 'similar',
                'priority': 'medium',
                'message': f'Found {len(similar)} groups of similar images that may be duplicates',
                'action': 'review_similar'
            })
        
        if efficiency_score < 90:
            recommendations.append({
                'type': 'efficiency',
                'priority': 'medium',
                'message': f'Storage efficiency is {efficiency_score}%. Consider running optimization.',
                'action': 'optimize'
            })
        
        return {
            "success": True,
            "report": {
                "statistics": stats,
                "duplicate_groups": len(duplicates),
                "similar_groups": len(similar),
                "efficiency_score": efficiency_score,
                "recommendations": recommendations,
                "summary": {
                    "total_images": total_images,
                    "total_size_mb": round(total_size / (1024 * 1024), 2),
                    "potential_savings_mb": round(potential_savings / (1024 * 1024), 2),
                    "efficiency_rating": "Excellent" if efficiency_score >= 95 else "Good" if efficiency_score >= 85 else "Needs Improvement"
                }
            }
        }
        
    except Exception as e:
        logger.error(f"Get efficiency report error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate efficiency report"
        )

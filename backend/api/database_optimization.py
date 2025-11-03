"""
Database optimization API endpoints.
Provides access to database indexing and performance optimization tools.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any
import logging

from models import get_db
from models.user import User
from utils.middleware import require_auth
from services.database_indexing_service import DatabaseIndexingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/database", tags=["database-optimization"])

@router.get("/performance-summary")
async def get_database_performance_summary(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get comprehensive database performance summary"""
    try:
        # Only allow super admins to access database optimization
        if current_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only super admins can access database optimization tools"
            )
        
        indexing_service = DatabaseIndexingService(db)
        summary = indexing_service.get_database_performance_summary()
        
        return {
            "success": True,
            "data": summary,
            "message": "Database performance summary retrieved successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get database performance summary error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve database performance summary"
        )

@router.get("/table-analysis/{table_name}")
async def analyze_table_performance(
    table_name: str,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Analyze performance of a specific table"""
    try:
        # Only allow super admins to access database optimization
        if current_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only super admins can access database optimization tools"
            )
        
        indexing_service = DatabaseIndexingService(db)
        analysis = indexing_service.analyze_table_performance(table_name)
        
        if 'error' in analysis:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=analysis['error']
            )
        
        return {
            "success": True,
            "data": analysis,
            "message": f"Table analysis for {table_name} completed successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analyze table performance error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to analyze table performance"
        )

@router.post("/create-indexes")
async def create_performance_indexes(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Create recommended performance indexes"""
    try:
        # Only allow super admins to create indexes
        if current_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only super admins can create database indexes"
            )
        
        indexing_service = DatabaseIndexingService(db)
        results = indexing_service.create_performance_indexes()
        
        return {
            "success": True,
            "data": results,
            "message": f"Index creation completed. Created: {len(results['created'])}, Already existed: {len(results['already_exists'])}, Errors: {len(results['errors'])}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create performance indexes error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create performance indexes"
        )

@router.get("/indexes")
async def list_database_indexes(
    table_name: str = None,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """List all database indexes, optionally filtered by table"""
    try:
        # Only allow super admins to access database optimization
        if current_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only super admins can access database optimization tools"
            )
        
        indexing_service = DatabaseIndexingService(db)
        
        if table_name:
            # Get indexes for specific table
            analysis = indexing_service.analyze_table_performance(table_name)
            if 'error' in analysis:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=analysis['error']
                )
            indexes = analysis['indexes']
        else:
            # Get all indexes
            summary = indexing_service.get_database_performance_summary()
            if 'error' in summary:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=summary['error']
                )
            
            indexes = []
            for table, analysis in summary['tables'].items():
                for index in analysis['indexes']:
                    index['table_name'] = table
                    indexes.append(index)
        
        return {
            "success": True,
            "data": {
                "indexes": indexes,
                "count": len(indexes),
                "table_filter": table_name
            },
            "message": f"Retrieved {len(indexes)} database indexes"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"List database indexes error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve database indexes"
        )

@router.get("/recommendations")
async def get_optimization_recommendations(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get database optimization recommendations"""
    try:
        # Only allow super admins to access database optimization
        if current_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only super admins can access database optimization tools"
            )
        
        indexing_service = DatabaseIndexingService(db)
        summary = indexing_service.get_database_performance_summary()
        
        if 'error' in summary:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=summary['error']
            )
        
        # Collect all recommendations
        all_recommendations = []
        
        # Global recommendations
        all_recommendations.extend(summary.get('recommendations', []))
        
        # Table-specific recommendations
        for table, analysis in summary['tables'].items():
            table_recommendations = analysis.get('recommendations', [])
            for rec in table_recommendations:
                all_recommendations.append(f"{table}: {rec}")
        
        return {
            "success": True,
            "data": {
                "recommendations": all_recommendations,
                "count": len(all_recommendations),
                "database_summary": summary['summary']
            },
            "message": f"Retrieved {len(all_recommendations)} optimization recommendations"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get optimization recommendations error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve optimization recommendations"
        )















"""
Performance monitoring API endpoints.
Provides access to application performance metrics and statistics.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any
import logging

from models import get_db
from models.user import User
from utils.middleware import require_auth
from utils.performance_middleware import get_performance_stats, performance_metrics

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/performance", tags=["performance"])

@router.get("/stats")
async def get_performance_statistics(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get current application performance statistics"""
    try:
        stats = get_performance_stats()
        
        return {
            "success": True,
            "data": stats,
            "message": "Performance statistics retrieved successfully"
        }
        
    except Exception as e:
        logger.error(f"Get performance statistics error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve performance statistics"
        )

@router.get("/health")
async def get_health_check(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get application health status with performance indicators"""
    try:
        stats = get_performance_stats()
        
        # Determine health status based on metrics
        health_status = "healthy"
        issues = []
        
        # Check response times
        avg_response_time = stats.get('response_times', {}).get('avg_ms', 0)
        if avg_response_time > 1000:  # > 1 second
            health_status = "degraded"
            issues.append(f"High average response time: {avg_response_time}ms")
        
        # Check database performance
        avg_query_time = stats.get('database_queries', {}).get('avg_ms', 0)
        if avg_query_time > 500:  # > 500ms
            health_status = "degraded"
            issues.append(f"High average query time: {avg_query_time}ms")
        
        # Check system resources
        system = stats.get('system', {})
        if system.get('cpu_percent', 0) > 80:
            health_status = "degraded"
            issues.append(f"High CPU usage: {system.get('cpu_percent', 0)}%")
        
        if system.get('memory_percent', 0) > 85:
            health_status = "degraded"
            issues.append(f"High memory usage: {system.get('memory_percent', 0)}%")
        
        # Check for errors
        error_count = sum(stats.get('errors', {}).values())
        if error_count > 10:  # More than 10 errors
            health_status = "unhealthy"
            issues.append(f"High error count: {error_count}")
        
        return {
            "success": True,
            "data": {
                "status": health_status,
                "issues": issues,
                "timestamp": stats.get('timestamp'),
                "metrics": {
                    "response_time_avg_ms": avg_response_time,
                    "query_time_avg_ms": avg_query_time,
                    "cpu_percent": system.get('cpu_percent', 0),
                    "memory_percent": system.get('memory_percent', 0),
                    "error_count": error_count
                }
            },
            "message": f"Health check completed - Status: {health_status}"
        }
        
    except Exception as e:
        logger.error(f"Health check error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Health check failed"
        )

@router.get("/slow-queries")
async def get_slow_queries(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get recent slow database queries"""
    try:
        stats = get_performance_stats()
        slow_queries = stats.get('slow_queries', [])
        
        return {
            "success": True,
            "data": {
                "slow_queries": slow_queries,
                "count": len(slow_queries)
            },
            "message": f"Retrieved {len(slow_queries)} slow queries"
        }
        
    except Exception as e:
        logger.error(f"Get slow queries error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve slow queries"
        )

@router.get("/endpoints")
async def get_endpoint_performance(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get performance statistics by endpoint"""
    try:
        stats = get_performance_stats()
        endpoint_stats = stats.get('endpoints', {})
        
        # Sort endpoints by average response time
        sorted_endpoints = sorted(
            endpoint_stats.items(),
            key=lambda x: x[1].get('avg_time', 0),
            reverse=True
        )
        
        return {
            "success": True,
            "data": {
                "endpoints": dict(sorted_endpoints),
                "total_endpoints": len(endpoint_stats)
            },
            "message": f"Retrieved performance data for {len(endpoint_stats)} endpoints"
        }
        
    except Exception as e:
        logger.error(f"Get endpoint performance error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve endpoint performance data"
        )

@router.post("/reset-metrics")
async def reset_performance_metrics(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Reset performance metrics (admin only)"""
    try:
        # Only allow super admins to reset metrics
        if current_user.role != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only super admins can reset performance metrics"
            )
        
        # Reset metrics
        performance_metrics.response_times.clear()
        performance_metrics.query_times.clear()
        performance_metrics.slow_queries.clear()
        performance_metrics.system_metrics.clear()
        performance_metrics.error_counts.clear()
        
        # Clear endpoint times
        for endpoint_times in performance_metrics.endpoint_times.values():
            endpoint_times.clear()
        
        return {
            "success": True,
            "message": "Performance metrics reset successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset performance metrics error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset performance metrics"
        )



















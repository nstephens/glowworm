"""
Performance monitoring middleware for FastAPI application.
Tracks response times, database query performance, and system metrics.
"""

import time
import logging
from typing import Callable, Dict, Any
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import psutil
import threading
from collections import defaultdict, deque
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)

class PerformanceMetrics:
    """Thread-safe performance metrics collector"""
    
    def __init__(self, max_history: int = 1000):
        self.max_history = max_history
        self._lock = threading.Lock()
        
        # Response time metrics
        self.response_times = deque(maxlen=max_history)
        self.endpoint_times = defaultdict(lambda: deque(maxlen=100))
        
        # Database query metrics
        self.query_times = deque(maxlen=max_history)
        self.slow_queries = deque(maxlen=100)
        
        # System metrics
        self.system_metrics = deque(maxlen=100)
        
        # Error tracking
        self.error_counts = defaultdict(int)
        
    def record_response_time(self, endpoint: str, method: str, duration: float, status_code: int):
        """Record API response time"""
        with self._lock:
            self.response_times.append({
                'timestamp': datetime.utcnow(),
                'endpoint': endpoint,
                'method': method,
                'duration': duration,
                'status_code': status_code
            })
            self.endpoint_times[f"{method} {endpoint}"].append(duration)
    
    def record_query_time(self, query: str, duration: float, rows_affected: int = 0):
        """Record database query performance"""
        with self._lock:
            self.query_times.append({
                'timestamp': datetime.utcnow(),
                'query': query[:200],  # Truncate long queries
                'duration': duration,
                'rows_affected': rows_affected
            })
            
            if duration > 1.0:  # Log slow queries (>1 second)
                self.slow_queries.append({
                    'timestamp': datetime.utcnow(),
                    'query': query,
                    'duration': duration,
                    'rows_affected': rows_affected
                })
    
    def record_system_metrics(self):
        """Record current system metrics"""
        with self._lock:
            self.system_metrics.append({
                'timestamp': datetime.utcnow(),
                'cpu_percent': psutil.cpu_percent(),
                'memory_percent': psutil.virtual_memory().percent,
                'disk_percent': psutil.disk_usage('/').percent
            })
    
    def record_error(self, endpoint: str, error_type: str):
        """Record error occurrence"""
        with self._lock:
            self.error_counts[f"{endpoint}:{error_type}"] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current performance statistics"""
        with self._lock:
            now = datetime.utcnow()
            last_hour = now - timedelta(hours=1)
            
            # Filter recent data
            recent_responses = [r for r in self.response_times if r['timestamp'] > last_hour]
            recent_queries = [q for q in self.query_times if q['timestamp'] > last_hour]
            
            # Calculate response time stats
            if recent_responses:
                response_durations = [r['duration'] for r in recent_responses]
                avg_response_time = sum(response_durations) / len(response_durations)
                max_response_time = max(response_durations)
                min_response_time = min(response_durations)
            else:
                avg_response_time = max_response_time = min_response_time = 0
            
            # Calculate query stats
            if recent_queries:
                query_durations = [q['duration'] for q in recent_queries]
                avg_query_time = sum(query_durations) / len(query_durations)
                max_query_time = max(query_durations)
                slow_query_count = len([q for q in query_durations if q > 1.0])
            else:
                avg_query_time = max_query_time = slow_query_count = 0
            
            # Get endpoint performance
            endpoint_stats = {}
            for endpoint, times in self.endpoint_times.items():
                if times:
                    endpoint_stats[endpoint] = {
                        'avg_time': sum(times) / len(times),
                        'max_time': max(times),
                        'request_count': len(times)
                    }
            
            # Get latest system metrics
            latest_system = self.system_metrics[-1] if self.system_metrics else {}
            
            return {
                'timestamp': now.isoformat(),
                'response_times': {
                    'avg_ms': round(avg_response_time * 1000, 2),
                    'max_ms': round(max_response_time * 1000, 2),
                    'min_ms': round(min_response_time * 1000, 2),
                    'total_requests': len(recent_responses)
                },
                'database_queries': {
                    'avg_ms': round(avg_query_time * 1000, 2),
                    'max_ms': round(max_query_time * 1000, 2),
                    'total_queries': len(recent_queries),
                    'slow_queries': slow_query_count
                },
                'endpoints': endpoint_stats,
                'system': latest_system,
                'errors': dict(self.error_counts),
                'slow_queries': list(self.slow_queries)[-10:]  # Last 10 slow queries
            }

# Global metrics instance
performance_metrics = PerformanceMetrics()

class PerformanceMonitoringMiddleware(BaseHTTPMiddleware):
    """Middleware to monitor API performance"""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.metrics = performance_metrics
        
        # Start system metrics collection
        self._start_system_monitoring()
    
    def _get_system_metrics_interval(self):
        """Get system metrics collection interval from settings"""
        try:
            from services.config_service import config_service
            interval = config_service.display_status_check_interval
            # Ensure it's an integer (settings might return string from database)
            return int(interval) if interval is not None else 30
        except Exception:
            return 30  # Fallback to hardcoded value if settings not available

    def _start_system_monitoring(self):
        """Start background system metrics collection"""
        def collect_metrics():
            while True:
                try:
                    self.metrics.record_system_metrics()
                    time.sleep(self._get_system_metrics_interval())  # Collect at configurable interval
                except Exception as e:
                    logger.error(f"Error collecting system metrics: {e}")
                    time.sleep(60)  # Wait longer on error
        
        thread = threading.Thread(target=collect_metrics, daemon=True)
        thread.start()
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and record performance metrics"""
        start_time = time.time()
        
        # Extract endpoint info
        endpoint = request.url.path
        method = request.method
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            
            # Record metrics
            self.metrics.record_response_time(
                endpoint=endpoint,
                method=method,
                duration=duration,
                status_code=response.status_code
            )
            
            # Add performance headers
            response.headers["X-Response-Time"] = f"{duration:.4f}s"
            response.headers["X-Request-ID"] = str(int(start_time * 1000000))
            
            return response
            
        except Exception as e:
            # Record error
            duration = time.time() - start_time
            self.metrics.record_error(endpoint, type(e).__name__)
            self.metrics.record_response_time(
                endpoint=endpoint,
                method=method,
                duration=duration,
                status_code=500
            )
            raise

class DatabaseQueryProfiler:
    """Context manager for profiling database queries"""
    
    def __init__(self, query: str):
        self.query = query
        self.start_time = None
        self.rows_affected = 0
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.start_time:
            duration = time.time() - self.start_time
            performance_metrics.record_query_time(
                query=self.query,
                duration=duration,
                rows_affected=self.rows_affected
            )
    
    def set_rows_affected(self, count: int):
        """Set the number of rows affected by the query"""
        self.rows_affected = count

def get_performance_stats() -> Dict[str, Any]:
    """Get current performance statistics"""
    return performance_metrics.get_stats()

def profile_query(query: str):
    """Create a query profiler context manager"""
    return DatabaseQueryProfiler(query)




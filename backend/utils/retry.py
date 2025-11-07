"""
Retry logic and circuit breaker utilities for background task processing.

Provides exponential backoff retry mechanism and circuit breaker pattern
for handling transient failures in image processing tasks.
"""

import time
import asyncio
import logging
from typing import Callable, Any, Dict, List
from functools import wraps

logger = logging.getLogger(__name__)


def retry_with_backoff(max_attempts: int = 3, base_delay: float = 1.0):
    """
    Decorator for retrying functions with exponential backoff.
    
    Args:
        max_attempts: Maximum number of retry attempts (default: 3)
        base_delay: Base delay in seconds for exponential backoff (default: 1.0)
        
    Returns:
        Decorated function that retries on failure
        
    Example:
        @retry_with_backoff(max_attempts=3, base_delay=2.0)
        def process_image(image_id):
            # Process logic here
            pass
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            attempt = 0
            last_error = None
            
            while attempt < max_attempts:
                try:
                    # Exponential backoff: base_delay * 2^attempt
                    if attempt > 0:
                        backoff_time = base_delay * (2 ** (attempt - 1))
                        logger.info(f"Retry attempt {attempt}/{max_attempts} after {backoff_time}s backoff")
                        time.sleep(backoff_time)
                    
                    # Try to execute the function
                    return func(*args, **kwargs)
                    
                except Exception as e:
                    attempt += 1
                    last_error = e
                    
                    # Log the error
                    logger.warning(
                        f"Attempt {attempt}/{max_attempts} failed for {func.__name__}: {str(e)}"
                    )
                    
                    # If this was the last attempt, we'll raise the error
                    if attempt >= max_attempts:
                        logger.error(
                            f"All {max_attempts} attempts failed for {func.__name__}: {str(last_error)}"
                        )
            
            # If we get here, all attempts failed
            raise last_error
            
        return wrapper
    return decorator


class CircuitBreaker:
    """
    Circuit breaker pattern implementation for preventing repeated failures.
    
    Tracks failures per image/task and opens the circuit (stops processing)
    if too many failures occur within a time window.
    
    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Too many failures, requests blocked
    - HALF_OPEN: Testing if service recovered (not implemented yet)
    
    Example:
        circuit_breaker = CircuitBreaker(failure_threshold=5, reset_timeout=3600)
        
        if circuit_breaker.is_open(image_id):
            logger.error("Circuit breaker open, skipping processing")
            return
            
        try:
            process_image(image_id)
            circuit_breaker.record_success(image_id)
        except Exception:
            circuit_breaker.record_failure(image_id)
    """
    
    def __init__(self, failure_threshold: int = 5, reset_timeout: int = 3600):
        """
        Initialize circuit breaker.
        
        Args:
            failure_threshold: Number of failures before opening circuit (default: 5)
            reset_timeout: Seconds before resetting failure count (default: 3600 = 1 hour)
        """
        self.failures: Dict[int, List[float]] = {}
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
    
    def record_failure(self, task_id: int) -> None:
        """
        Record a failure for a task.
        
        Args:
            task_id: The ID of the task/image that failed
        """
        now = time.time()
        
        if task_id not in self.failures:
            self.failures[task_id] = []
        
        self.failures[task_id].append(now)
        
        # Clean up old failures outside the reset window
        self.failures[task_id] = [
            timestamp for timestamp in self.failures[task_id]
            if now - timestamp < self.reset_timeout
        ]
        
        failure_count = len(self.failures[task_id])
        logger.info(f"Recorded failure for task {task_id}: {failure_count}/{self.failure_threshold} failures")
        
        if failure_count >= self.failure_threshold:
            logger.error(
                f"Circuit breaker OPENED for task {task_id}: "
                f"{failure_count} failures in {self.reset_timeout}s window"
            )
    
    def record_success(self, task_id: int) -> None:
        """
        Record a success for a task, clearing its failure history.
        
        Args:
            task_id: The ID of the task/image that succeeded
        """
        if task_id in self.failures:
            del self.failures[task_id]
            logger.info(f"Cleared failure history for task {task_id} after success")
    
    def is_open(self, task_id: int) -> bool:
        """
        Check if the circuit breaker is open for a task.
        
        Args:
            task_id: The ID of the task/image to check
            
        Returns:
            True if circuit is open (too many failures), False otherwise
        """
        if task_id not in self.failures:
            return False
        
        # Clean up old failures
        now = time.time()
        self.failures[task_id] = [
            timestamp for timestamp in self.failures[task_id]
            if now - timestamp < self.reset_timeout
        ]
        
        # Check if threshold exceeded
        failure_count = len(self.failures[task_id])
        is_open = failure_count >= self.failure_threshold
        
        if is_open:
            logger.warning(
                f"Circuit breaker is OPEN for task {task_id}: "
                f"{failure_count} failures in {self.reset_timeout}s window"
            )
        
        return is_open
    
    def get_failure_count(self, task_id: int) -> int:
        """
        Get current failure count for a task.
        
        Args:
            task_id: The ID of the task/image
            
        Returns:
            Number of failures within the reset timeout window
        """
        if task_id not in self.failures:
            return 0
        
        # Clean up old failures
        now = time.time()
        self.failures[task_id] = [
            timestamp for timestamp in self.failures[task_id]
            if now - timestamp < self.reset_timeout
        ]
        
        return len(self.failures[task_id])
    
    def reset(self, task_id: int) -> None:
        """
        Manually reset the circuit breaker for a task.
        Useful for manual retry operations.
        
        Args:
            task_id: The ID of the task/image to reset
        """
        if task_id in self.failures:
            del self.failures[task_id]
            logger.info(f"Circuit breaker manually reset for task {task_id}")


# Global circuit breaker instance for image processing
image_processing_circuit_breaker = CircuitBreaker(
    failure_threshold=5,  # 5 failures
    reset_timeout=3600    # within 1 hour
)


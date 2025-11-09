"""
Advanced error handling and recovery mechanisms for the daemon
"""
import logging
import time
import functools
from typing import Callable, Any, Optional, Type
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class RetryStrategy:
    """Retry strategy with exponential backoff"""
    
    def __init__(
        self,
        max_retries: int = 3,
        initial_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
    ):
        self.max_retries = max_retries
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.attempt = 0
    
    def get_delay(self) -> float:
        """Calculate delay for current attempt"""
        if self.attempt == 0:
            return 0
        
        delay = self.initial_delay * (self.exponential_base ** (self.attempt - 1))
        return min(delay, self.max_delay)
    
    def increment(self) -> None:
        """Increment attempt counter"""
        self.attempt += 1
    
    def reset(self) -> None:
        """Reset attempt counter"""
        self.attempt = 0
    
    def should_retry(self) -> bool:
        """Check if should retry"""
        return self.attempt < self.max_retries


def with_retry(
    max_retries: int = 3,
    initial_delay: float = 1.0,
    exceptions: tuple = (Exception,),
    on_retry: Optional[Callable] = None,
):
    """
    Decorator for retrying functions with exponential backoff
    
    Args:
        max_retries: Maximum number of retries
        initial_delay: Initial delay in seconds
        exceptions: Tuple of exceptions to catch
        on_retry: Callback function called on each retry
    
    Example:
        @with_retry(max_retries=3, initial_delay=2.0)
        def fetch_data():
            return requests.get(url)
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            strategy = RetryStrategy(max_retries=max_retries, initial_delay=initial_delay)
            last_exception = None
            
            while strategy.should_retry():
                try:
                    return func(*args, **kwargs)
                
                except exceptions as e:
                    last_exception = e
                    strategy.increment()
                    
                    if strategy.should_retry():
                        delay = strategy.get_delay()
                        logger.warning(
                            f"Attempt {strategy.attempt}/{max_retries} failed for "
                            f"{func.__name__}: {e}. Retrying in {delay:.1f}s..."
                        )
                        
                        if on_retry:
                            on_retry(e, strategy.attempt)
                        
                        time.sleep(delay)
                    else:
                        logger.error(
                            f"All {max_retries} attempts failed for {func.__name__}: {e}"
                        )
            
            # All retries exhausted
            raise last_exception
        
        return wrapper
    return decorator


class CircuitBreaker:
    """
    Circuit breaker pattern for fault tolerance
    
    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Too many failures, requests fail immediately
    - HALF_OPEN: Testing if service recovered, limited requests allowed
    """
    
    STATE_CLOSED = "closed"
    STATE_OPEN = "open"
    STATE_HALF_OPEN = "half_open"
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        expected_exception: Type[Exception] = Exception,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        
        self.failure_count = 0
        self.last_failure_time = None
        self.state = self.STATE_CLOSED
    
    def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function with circuit breaker protection
        
        Args:
            func: Function to call
            *args, **kwargs: Arguments to pass to function
        
        Returns:
            Function result
        
        Raises:
            Exception: If circuit is open or function fails
        """
        if self.state == self.STATE_OPEN:
            if self._should_attempt_reset():
                self.state = self.STATE_HALF_OPEN
                logger.info("Circuit breaker entering HALF_OPEN state")
            else:
                raise Exception("Circuit breaker is OPEN")
        
        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        
        except self.expected_exception as e:
            self._on_failure()
            raise e
    
    def _on_success(self) -> None:
        """Handle successful call"""
        if self.state == self.STATE_HALF_OPEN:
            logger.info("Circuit breaker closing after successful call")
        
        self.failure_count = 0
        self.state = self.STATE_CLOSED
    
    def _on_failure(self) -> None:
        """Handle failed call"""
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        
        if self.failure_count >= self.failure_threshold:
            self.state = self.STATE_OPEN
            logger.error(
                f"Circuit breaker opened after {self.failure_count} failures"
            )
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        if self.last_failure_time is None:
            return True
        
        elapsed = (datetime.now() - self.last_failure_time).total_seconds()
        return elapsed >= self.recovery_timeout


class HealthCheck:
    """Health monitoring for daemon components"""
    
    def __init__(self, name: str, timeout: float = 300.0):
        self.name = name
        self.timeout = timeout
        self.last_heartbeat = datetime.now()
        self.healthy = True
    
    def heartbeat(self) -> None:
        """Record a heartbeat"""
        self.last_heartbeat = datetime.now()
        if not self.healthy:
            logger.info(f"Component {self.name} is now healthy")
            self.healthy = True
    
    def check(self) -> bool:
        """
        Check if component is healthy
        
        Returns:
            True if healthy, False otherwise
        """
        elapsed = (datetime.now() - self.last_heartbeat).total_seconds()
        
        if elapsed > self.timeout:
            if self.healthy:
                logger.error(
                    f"Component {self.name} unhealthy (no heartbeat for {elapsed:.1f}s)"
                )
                self.healthy = False
            return False
        
        return True
    
    @property
    def time_since_heartbeat(self) -> float:
        """Get time since last heartbeat in seconds"""
        return (datetime.now() - self.last_heartbeat).total_seconds()


def safe_execute(func: Callable, default: Any = None, log_errors: bool = True) -> Any:
    """
    Safely execute a function, returning default value on error
    
    Args:
        func: Function to execute
        default: Default value to return on error
        log_errors: Whether to log errors
    
    Returns:
        Function result or default value
    """
    try:
        return func()
    except Exception as e:
        if log_errors:
            logger.error(f"Error in {func.__name__}: {e}", exc_info=True)
        return default


if __name__ == "__main__":
    # Test error handling mechanisms
    logging.basicConfig(level=logging.INFO)
    
    print("Testing retry mechanism...")
    
    @with_retry(max_retries=3, initial_delay=0.5)
    def flaky_function(attempt_counter: list):
        attempt_counter[0] += 1
        if attempt_counter[0] < 3:
            raise ConnectionError(f"Attempt {attempt_counter[0]} failed")
        return "Success!"
    
    counter = [0]
    result = flaky_function(counter)
    print(f"Result: {result} (took {counter[0]} attempts)")
    
    print("\nTesting circuit breaker...")
    cb = CircuitBreaker(failure_threshold=3, recovery_timeout=2.0)
    
    def failing_function():
        raise ConnectionError("Service unavailable")
    
    for i in range(5):
        try:
            cb.call(failing_function)
        except Exception as e:
            print(f"Attempt {i+1}: {e}")
    
    print(f"Circuit breaker state: {cb.state}")
    
    print("\nError handling tests complete!")


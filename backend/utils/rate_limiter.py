"""
Simple rate limiter for API endpoints
Uses in-memory storage with automatic cleanup
"""
from datetime import datetime, timedelta
from typing import Dict, Tuple
import threading
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Simple rate limiter with sliding window
    
    Tracks request counts per identifier within a time window.
    """
    
    def __init__(self, max_requests: int, time_window: int):
        """
        Initialize rate limiter
        
        Args:
            max_requests: Maximum requests allowed in time window
            time_window: Time window in seconds
        """
        self.max_requests = max_requests
        self.time_window = timedelta(seconds=time_window)
        self.requests: Dict[str, list] = {}
        self.lock = threading.Lock()
        
        logger.info(
            f"Rate limiter initialized: {max_requests} requests per "
            f"{time_window}s"
        )
    
    def check_rate_limit(self, identifier: str) -> bool:
        """
        Check if request is within rate limit
        
        Args:
            identifier: Unique identifier (e.g., "device_123", "user_456")
        
        Returns:
            True if request is allowed, False if rate limit exceeded
        """
        with self.lock:
            now = datetime.now()
            
            # Initialize or get request list for this identifier
            if identifier not in self.requests:
                self.requests[identifier] = []
            
            # Remove old requests outside the time window
            cutoff = now - self.time_window
            self.requests[identifier] = [
                timestamp for timestamp in self.requests[identifier]
                if timestamp > cutoff
            ]
            
            # Check if under limit
            if len(self.requests[identifier]) < self.max_requests:
                # Allow request and record it
                self.requests[identifier].append(now)
                return True
            else:
                # Rate limit exceeded
                logger.debug(
                    f"Rate limit exceeded for {identifier}: "
                    f"{len(self.requests[identifier])}/{self.max_requests}"
                )
                return False
    
    def get_remaining(self, identifier: str) -> Tuple[int, int]:
        """
        Get remaining requests for identifier
        
        Args:
            identifier: Unique identifier
        
        Returns:
            Tuple of (remaining_requests, total_limit)
        """
        with self.lock:
            if identifier not in self.requests:
                return (self.max_requests, self.max_requests)
            
            # Clean old requests
            now = datetime.now()
            cutoff = now - self.time_window
            self.requests[identifier] = [
                timestamp for timestamp in self.requests[identifier]
                if timestamp > cutoff
            ]
            
            used = len(self.requests[identifier])
            remaining = max(0, self.max_requests - used)
            
            return (remaining, self.max_requests)
    
    def reset(self, identifier: str) -> None:
        """
        Reset rate limit for identifier
        
        Args:
            identifier: Unique identifier to reset
        """
        with self.lock:
            if identifier in self.requests:
                del self.requests[identifier]
                logger.debug(f"Rate limit reset for {identifier}")
    
    def cleanup(self, max_age_minutes: int = 60) -> int:
        """
        Clean up old identifiers that haven't been used recently
        
        Args:
            max_age_minutes: Remove identifiers not used in this many minutes
        
        Returns:
            Number of identifiers cleaned up
        """
        with self.lock:
            now = datetime.now()
            cutoff = now - timedelta(minutes=max_age_minutes)
            
            to_remove = []
            for identifier, timestamps in self.requests.items():
                if not timestamps or max(timestamps) < cutoff:
                    to_remove.append(identifier)
            
            for identifier in to_remove:
                del self.requests[identifier]
            
            if to_remove:
                logger.info(f"Cleaned up {len(to_remove)} rate limit entries")
            
            return len(to_remove)


if __name__ == "__main__":
    # Test rate limiter
    import time
    
    logging.basicConfig(level=logging.INFO)
    
    print("Testing rate limiter...")
    limiter = RateLimiter(max_requests=5, time_window=2)
    
    # Test 1: Within limit
    print("\nTest 1: Within limit (5 requests)")
    for i in range(5):
        result = limiter.check_rate_limit("test_user")
        print(f"  Request {i+1}: {'✓ Allowed' if result else '✗ Blocked'}")
    
    # Test 2: Exceed limit
    print("\nTest 2: Exceeding limit (6th request)")
    result = limiter.check_rate_limit("test_user")
    print(f"  Request 6: {'✓ Allowed' if result else '✗ Blocked'}")
    
    # Test 3: Check remaining
    remaining, total = limiter.get_remaining("test_user")
    print(f"\nTest 3: Remaining requests: {remaining}/{total}")
    
    # Test 4: Wait for window to expire
    print("\nTest 4: Waiting 2s for window to expire...")
    time.sleep(2.1)
    result = limiter.check_rate_limit("test_user")
    print(f"  Request after wait: {'✓ Allowed' if result else '✗ Blocked'}")
    
    print("\n✅ Rate limiter tests complete!")


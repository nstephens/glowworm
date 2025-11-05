from fastapi import HTTPException, Request, status
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class CSRFProtection:
    """CSRF protection utility"""
    
    # Methods that require CSRF protection
    PROTECTED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
    
    # Endpoints that are exempt from CSRF protection
    EXEMPT_ENDPOINTS = {
        "/api/auth/login",
        "/api/auth/google/login",
        "/api/auth/google/callback",
        "/api/setup/complete",
        "/api/setup/test-database-connection",
        "/api/setup/check-user",
        "/api/setup/recreate-user",
    }
    
    @staticmethod
    def is_protected_method(method: str) -> bool:
        """Check if HTTP method requires CSRF protection"""
        return method.upper() in CSRFProtection.PROTECTED_METHODS
    
    @staticmethod
    def is_exempt_endpoint(path: str) -> bool:
        """Check if endpoint is exempt from CSRF protection"""
        return path in CSRFProtection.EXEMPT_ENDPOINTS
    
    @staticmethod
    def validate_csrf_token(request: Request, token: Optional[str] = None) -> bool:
        """Validate CSRF token for request"""
        from utils.cookies import cookie_manager
        
        logger.info(f"🔒 CSRF Validation - Method: {request.method}, Path: {request.url.path}")
        
        # Skip CSRF validation for exempt endpoints
        if CSRFProtection.is_exempt_endpoint(request.url.path):
            logger.info(f"✅ CSRF skipped - exempt endpoint: {request.url.path}")
            return True
        
        # Skip CSRF validation for non-protected methods
        if not CSRFProtection.is_protected_method(request.method):
            logger.info(f"✅ CSRF skipped - non-protected method: {request.method}")
            return True
        
        # Validate CSRF token
        result = cookie_manager.validate_csrf_token(request, token)
        logger.info(f"🔒 CSRF token validation result: {result}")
        return result
    
    @staticmethod
    def require_csrf_token(request: Request, token: Optional[str] = None) -> None:
        """Require valid CSRF token or raise exception"""
        if not CSRFProtection.validate_csrf_token(request, token):
            logger.warning(f"CSRF token validation failed for {request.method} {request.url.path}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token validation failed"
            )

# Global CSRF protection instance
csrf_protection = CSRFProtection()

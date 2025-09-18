from fastapi import Request, Response
from typing import Optional, Tuple, Dict, Any
from datetime import datetime, timedelta
from config.settings import settings
import secrets
import logging

logger = logging.getLogger(__name__)

class CookieManager:
    """Enhanced cookie manager with security best practices"""
    
    # Cookie names
    SESSION_COOKIE = "glowworm_session"
    REFRESH_COOKIE = "glowworm_refresh"
    CSRF_COOKIE = "glowworm_csrf"
    DISPLAY_COOKIE = "glowworm_display"
    
    @staticmethod
    def _get_cookie_config() -> Dict[str, Any]:
        """Get secure cookie configuration"""
        return {
            "httponly": True,  # Always HttpOnly for security
            "secure": settings.cookie_secure,  # Secure in production
            "samesite": "lax",  # Balance security and functionality
            "path": "/",  # Restrict to application root
            # Don't set domain to avoid subdomain issues
        }
    
    @staticmethod
    def set_auth_cookies(
        response: Response,
        session_token: str,
        refresh_token: Optional[str] = None,
        max_age: Optional[int] = None,
        csrf_token: Optional[str] = None
    ) -> None:
        """Set authentication cookies with enhanced security"""
        if max_age is None:
            max_age = settings.cookie_max_age
        
        cookie_config = CookieManager._get_cookie_config()
        
        # Set session cookie
        response.set_cookie(
            key=CookieManager.SESSION_COOKIE,
            value=session_token,
            max_age=max_age,
            **cookie_config
        )
        
        # Set refresh cookie if provided
        if refresh_token:
            response.set_cookie(
                key=CookieManager.REFRESH_COOKIE,
                value=refresh_token,
                max_age=max_age * 2,  # Refresh token lasts twice as long
                **cookie_config
            )
        
        # Set CSRF token cookie if provided
        if csrf_token:
            # CSRF token needs to be accessible to JavaScript
            csrf_cookie_config = cookie_config.copy()
            csrf_cookie_config["httponly"] = False
            response.set_cookie(
                key=CookieManager.CSRF_COOKIE,
                value=csrf_token,
                max_age=max_age,
                **csrf_cookie_config
            )
    
    @staticmethod
    def get_auth_cookies(request: Request) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """Get authentication cookies from request"""
        session_token = request.cookies.get(CookieManager.SESSION_COOKIE)
        refresh_token = request.cookies.get(CookieManager.REFRESH_COOKIE)
        csrf_token = request.cookies.get(CookieManager.CSRF_COOKIE)
        return session_token, refresh_token, csrf_token
    
    @staticmethod
    def clear_auth_cookies(response: Response) -> None:
        """Clear authentication cookies"""
        cookie_config = CookieManager._get_cookie_config()
        
        response.delete_cookie(
            key=CookieManager.SESSION_COOKIE,
            **cookie_config
        )
        response.delete_cookie(
            key=CookieManager.REFRESH_COOKIE,
            **cookie_config
        )
        response.delete_cookie(
            key=CookieManager.CSRF_COOKIE,
            **cookie_config
        )
    
    @staticmethod
    def set_display_device_cookie(
        response: Response,
        device_token: str,
        max_age: Optional[int] = None
    ) -> None:
        """Set display device authentication cookie with enhanced security"""
        if max_age is None:
            max_age = settings.cookie_max_age * 365  # 1 year for display devices
        
        cookie_config = CookieManager._get_cookie_config()
        # Display devices need access from any path
        cookie_config["path"] = "/"
        
        response.set_cookie(
            key=CookieManager.DISPLAY_COOKIE,
            value=device_token,
            max_age=max_age,
            **cookie_config
        )
    
    @staticmethod
    def get_display_device_cookie(request: Request) -> Optional[str]:
        """Get display device cookie from request"""
        return request.cookies.get(CookieManager.DISPLAY_COOKIE)
    
    @staticmethod
    def clear_display_device_cookie(response: Response) -> None:
        """Clear display device cookie"""
        cookie_config = CookieManager._get_cookie_config()
        cookie_config["path"] = "/"
        
        response.delete_cookie(
            key=CookieManager.DISPLAY_COOKIE,
            **cookie_config
        )
    
    @staticmethod
    def generate_csrf_token() -> str:
        """Generate a secure CSRF token"""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def validate_csrf_token(request: Request, provided_token: Optional[str] = None) -> bool:
        """Validate CSRF token from request"""
        # Get token from header or parameter
        if not provided_token:
            provided_token = request.headers.get("X-CSRF-Token")
        
        if not provided_token:
            return False
        
        # Get stored token from cookie
        stored_token = request.cookies.get(CookieManager.CSRF_COOKIE)
        
        if not stored_token:
            return False
        
        # Compare tokens securely
        return secrets.compare_digest(provided_token, stored_token)
    
    @staticmethod
    def set_oauth_cookies(
        response: Response,
        code_verifier: str,
        state: str,
        max_age: int = 600  # 10 minutes for OAuth flow
    ) -> None:
        """Set OAuth flow cookies with enhanced security"""
        cookie_config = CookieManager._get_cookie_config()
        # OAuth cookies need shorter lifespan
        cookie_config["max_age"] = max_age
        
        response.set_cookie(
            key="oauth_code_verifier",
            value=code_verifier,
            **cookie_config
        )
        
        response.set_cookie(
            key="oauth_state",
            value=state,
            **cookie_config
        )
    
    @staticmethod
    def clear_oauth_cookies(response: Response) -> None:
        """Clear OAuth flow cookies"""
        cookie_config = CookieManager._get_cookie_config()
        
        response.delete_cookie(
            key="oauth_code_verifier",
            **cookie_config
        )
        response.delete_cookie(
            key="oauth_state",
            **cookie_config
        )
    
    @staticmethod
    def rotate_session_cookie(
        response: Response,
        new_session_token: str,
        max_age: Optional[int] = None
    ) -> None:
        """Rotate session cookie for enhanced security"""
        if max_age is None:
            max_age = settings.cookie_max_age
        
        cookie_config = CookieManager._get_cookie_config()
        
        # Clear old session cookie
        response.delete_cookie(
            key=CookieManager.SESSION_COOKIE,
            **cookie_config
        )
        
        # Set new session cookie
        response.set_cookie(
            key=CookieManager.SESSION_COOKIE,
            value=new_session_token,
            max_age=max_age,
            **cookie_config
        )

# Global cookie manager instance
cookie_manager = CookieManager()

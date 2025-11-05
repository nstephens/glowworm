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
    def _get_cookie_config(request: Optional[Request] = None) -> Dict[str, Any]:
        """Get secure cookie configuration"""
        # Don't set explicit cookie domain - this allows cookies to work
        # regardless of whether accessed via IP, localhost, or custom domain
        # Cookies will be scoped to the exact hostname used to access the app
        
        # Detect iOS web app (standalone mode)
        # iOS web apps have issues with SameSite="lax" cookies
        # We'll use "lax" for normal browsers, but can adjust for iOS web apps
        is_ios_webapp = False
        if request:
            user_agent = request.headers.get("user-agent", "").lower()
            # Check for iOS devices (Safari on iOS)
            # Note: iOS web apps don't reliably send "standalone" in user-agent
            # So we detect any iOS device which might be using web app mode
            is_ios_webapp = (
                ("iphone" in user_agent or "ipad" in user_agent) and
                "safari" in user_agent
            )
        
        config = {
            "httponly": True,  # Always HttpOnly for security
            "secure": settings.cookie_secure,  # Secure in production
            "samesite": "lax",  # Balance security and functionality (works better for iOS web apps than "strict")
            "path": "/",  # Restrict to application root
        }
        
        # For iOS web apps, we might need "none" with Secure, but that requires HTTPS
        # For now, "lax" should work better than "strict" for iOS web apps
        # If using HTTPS, we could use "none" for better iOS compatibility
        if is_ios_webapp and settings.cookie_secure:
            # iOS web apps work better with "none" when Secure is True
            config["samesite"] = "none"
        
        # Not setting 'domain' allows cookies to work with:
        # - Direct IP access (http://10.10.10.2:3003)
        # - Custom domains (https://gw.pdungeon.com)
        # - Localhost development (http://localhost:3003)
        
        return config
    
    @staticmethod
    def set_auth_cookies(
        response: Response,
        session_token: str,
        refresh_token: Optional[str] = None,
        max_age: Optional[int] = None,
        csrf_token: Optional[str] = None,
        request: Optional[Request] = None
    ) -> None:
        """Set authentication cookies with enhanced security"""
        if max_age is None:
            max_age = settings.cookie_max_age
        
        logger.debug(f"Setting auth cookies - session: {session_token[:8]}..., max_age: {max_age}")
        
        cookie_config = CookieManager._get_cookie_config(request)
        
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
        
        logger.debug(f"Retrieved cookies - session: {'present' if session_token else 'missing'}, refresh: {'present' if refresh_token else 'missing'}, csrf: {'present' if csrf_token else 'missing'}")
        
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
        
        logger.info(f"Setting display cookie '{CookieManager.DISPLAY_COOKIE}' with config: {cookie_config}")
        
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
        
        logger.info(f"🔑 CSRF Header Token: {provided_token[:20] if provided_token else 'None'}...")
        
        if not provided_token:
            logger.warning("❌ No CSRF token in header")
            return False
        
        # Get stored token from cookie
        stored_token = request.cookies.get(CookieManager.CSRF_COOKIE)
        
        logger.info(f"🍪 CSRF Cookie Token: {stored_token[:20] if stored_token else 'None'}...")
        
        if not stored_token:
            logger.warning("❌ No CSRF token in cookie")
            return False
        
        # Compare tokens securely
        result = secrets.compare_digest(provided_token, stored_token)
        logger.info(f"🔐 Token comparison result: {result}")
        return result
    
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

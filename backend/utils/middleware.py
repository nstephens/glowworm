from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
import logging

from models.database import get_db
from models.user import User, UserRole
from services.auth_service import AuthService
from utils.cookies import cookie_manager

logger = logging.getLogger(__name__)

# Security scheme for API documentation
security = HTTPBearer(auto_error=False)

class AuthMiddleware:
    """Authentication middleware for protecting routes"""
    
    @staticmethod
    def get_current_user(
        request: Request,
        db: Session = Depends(get_db),
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
    ) -> Optional[User]:
        """Get current authenticated user from cookies or bearer token"""
        logger.debug("Starting authentication check")
        
        auth_service = AuthService(db)
        
        # Try to get session from cookies first
        session_token, refresh_token, csrf_token = cookie_manager.get_auth_cookies(request)
        logger.debug(f"Cookie tokens - session: {'present' if session_token else 'missing'}, refresh: {'present' if refresh_token else 'missing'}, csrf: {'present' if csrf_token else 'missing'}")
        
        if session_token:
            logger.debug(f"Attempting session lookup with token: {session_token[:8]}...")
            user = auth_service.get_user_by_session(session_token)
            if user:
                logger.debug(f"Session authentication successful for user: {user.username}")
                return user
            else:
                logger.debug(f"Session token {session_token[:8]}... not found or invalid")
        
        # Try bearer token if no cookie session
        if credentials:
            logger.debug(f"Attempting bearer token authentication: {credentials.credentials[:8]}...")
            user = auth_service.get_user_by_session(credentials.credentials)
            if user:
                logger.debug(f"Bearer token authentication successful for user: {user.username}")
                return user
            else:
                logger.debug(f"Bearer token {credentials.credentials[:8]}... not found or invalid")
        
        logger.debug("No valid authentication found")
        return None
    
    @staticmethod
    def require_auth(
        request: Request,
        db: Session = Depends(get_db),
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
    ) -> User:
        """Require authentication - raise exception if not authenticated"""
        user = AuthMiddleware.get_current_user(request, db, credentials)
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user
    
    @staticmethod
    def require_admin(
        request: Request,
        db: Session = Depends(get_db),
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
    ) -> User:
        """Require admin authentication"""
        user = AuthMiddleware.require_auth(request, db, credentials)
        if not user.is_admin:
            raise HTTPException(
                status_code=403,
                detail="Admin access required"
            )
        return user
    
    @staticmethod
    def require_super_admin(
        request: Request,
        db: Session = Depends(get_db),
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
    ) -> User:
        """Require super admin authentication"""
        user = AuthMiddleware.require_auth(request, db, credentials)
        if not user.is_super_admin:
            raise HTTPException(
                status_code=403,
                detail="Super admin access required"
            )
        return user
    
    @staticmethod
    def get_display_device_token(request: Request) -> Optional[str]:
        """Get display device token from cookies"""
        return cookie_manager.get_display_device_cookie(request)
    
    @staticmethod
    def require_display_device(
        request: Request,
        db: Session = Depends(get_db)
    ) -> str:
        """Require display device authentication"""
        device_token = AuthMiddleware.get_display_device_token(request)
        if not device_token:
            raise HTTPException(
                status_code=401,
                detail="Display device authentication required"
            )
        
        # TODO: Implement display device token validation
        # For now, just return the token
        return device_token

# Dependency functions for use in route handlers
def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[User]:
    """Dependency to get current user (optional)"""
    return AuthMiddleware.get_current_user(request, db, credentials)

def require_auth(
    request: Request,
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> User:
    """Dependency to require authentication"""
    return AuthMiddleware.require_auth(request, db, credentials)

def require_admin(
    request: Request,
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> User:
    """Dependency to require admin access"""
    return AuthMiddleware.require_admin(request, db, credentials)

def require_super_admin(
    request: Request,
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> User:
    """Dependency to require super admin access"""
    return AuthMiddleware.require_super_admin(request, db, credentials)

def get_display_device_token(
    request: Request
) -> Optional[str]:
    """Dependency to get display device token"""
    return AuthMiddleware.get_display_device_token(request)

def require_display_device(
    request: Request,
    db: Session = Depends(get_db)
) -> str:
    """Dependency to require display device authentication"""
    return AuthMiddleware.require_display_device(request, db)

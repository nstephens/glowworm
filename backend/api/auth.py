from fastapi import APIRouter, Request, Response, HTTPException, Depends, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
import logging

from models.database import get_db
from models.user import User, UserRole
from services.auth_service import AuthService
from utils.middleware import get_current_user, require_auth
from utils.cookies import cookie_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["authentication"])

# Pydantic models for request/response
class LoginRequest(BaseModel):
    username: str = Field(..., description="Username")
    password: str = Field(..., description="Password")
    device_name: Optional[str] = Field(None, description="Device name")
    device_type: str = Field(default="admin", description="Device type")

class RegisterRequest(BaseModel):
    username: str = Field(..., description="Username")
    password: str = Field(..., description="Password")
    email: Optional[str] = Field(None, description="Email address")
    display_name: Optional[str] = Field(None, description="Display name")

class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., description="Current password")
    new_password: str = Field(..., description="New password")

class ResetPasswordRequest(BaseModel):
    user_id: int = Field(..., description="User ID")
    new_password: str = Field(..., description="New password")

class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]
    role: str
    is_active: bool
    display_name: Optional[str]
    avatar_url: Optional[str]
    created_at: Optional[str]
    last_login: Optional[str]
    is_admin: bool
    is_super_admin: bool

class LoginResponse(BaseModel):
    success: bool
    message: str
    user: Optional[UserResponse] = None

class SessionResponse(BaseModel):
    id: int
    user_id: int
    is_active: bool
    expires_at: str
    created_at: str
    last_used: str
    device_name: Optional[str]
    device_type: str

@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    response: Response,
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """Login user and create session"""
    logger.debug(f"Starting login attempt for username: {login_data.username}")
    
    try:
        auth_service = AuthService(db)
        
        # Authenticate user
        user = auth_service.authenticate_user(login_data.username, login_data.password)
        
        if not user:
            logger.warning(f"Authentication failed for username: {login_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )
        
        # Create session
        user_agent = request.headers.get("user-agent")
        ip_address = request.client.host if request.client else None
        
        session, csrf_token = auth_service.create_session_with_csrf(
            user=user,
            user_agent=user_agent,
            ip_address=ip_address,
            device_name=login_data.device_name,
            device_type=login_data.device_type
        )
        
        # Set authentication cookies
        cookie_manager.set_auth_cookies(
            response=response,
            session_token=session.session_token,
            refresh_token=session.refresh_token,
            csrf_token=csrf_token
        )
        
        logger.info(f"User {user.username} logged in successfully")
        
        return LoginResponse(
            success=True,
            message="Login successful",
            user=UserResponse(**user.to_dict())
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during login: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Logout user and clear session"""
    try:
        # Get session token from cookies
        session_token, _, _ = cookie_manager.get_auth_cookies(request)
        
        if session_token:
            auth_service = AuthService(db)
            auth_service.logout_session(session_token)
        
        # Clear authentication cookies
        cookie_manager.clear_auth_cookies(response)
        
        return {"success": True, "message": "Logout successful"}
        
    except Exception as e:
        logger.error(f"Logout failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Logout failed"
        )

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(require_auth)
):
    """Get current user information"""
    return UserResponse(**current_user.to_dict())

@router.post("/register")
async def register_user(
    request: Request,
    response: Response,
    register_data: RegisterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Register a new user (admin only)"""
    try:
        # Check if current user is admin
        if not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        auth_service = AuthService(db)
        
        # Create new user
        user = auth_service.create_user(
            username=register_data.username,
            password=register_data.password,
            email=register_data.email,
            display_name=register_data.display_name
        )
        
        logger.info(f"User {user.username} registered by {current_user.username}")
        
        return {
            "success": True,
            "message": "User registered successfully",
            "user": UserResponse(**user.to_dict())
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"User registration failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User registration failed"
        )

@router.post("/change-password")
async def change_password(
    change_data: ChangePasswordRequest,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Change user password"""
    try:
        auth_service = AuthService(db)
        
        success = auth_service.change_password(
            user=current_user,
            old_password=change_data.old_password,
            new_password=change_data.new_password
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid current password"
            )
        
        return {"success": True, "message": "Password changed successfully"}
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Password change failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed"
        )

@router.post("/reset-password")
async def reset_password(
    reset_data: ResetPasswordRequest,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Reset user password (admin only)"""
    try:
        # Check if current user is admin
        if not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        auth_service = AuthService(db)
        
        # Get target user
        target_user = db.query(User).filter(User.id == reset_data.user_id).first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Reset password
        auth_service.reset_password(target_user, reset_data.new_password)
        
        logger.info(f"Password reset for user {target_user.username} by {current_user.username}")
        
        return {"success": True, "message": "Password reset successfully"}
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Password reset failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password reset failed"
        )

@router.get("/sessions", response_model=list[SessionResponse])
async def get_user_sessions(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get current user's active sessions"""
    try:
        auth_service = AuthService(db)
        sessions = auth_service.get_user_sessions(current_user.id)
        
        return [SessionResponse(**session.to_dict()) for session in sessions]
        
    except Exception as e:
        logger.error(f"Failed to get user sessions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user sessions"
        )

@router.post("/logout-all")
async def logout_all_sessions(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Logout all sessions for current user"""
    try:
        auth_service = AuthService(db)
        count = auth_service.logout_all_user_sessions(current_user.id)
        
        return {
            "success": True,
            "message": f"Logged out {count} sessions",
            "sessions_logged_out": count
        }
        
    except Exception as e:
        logger.error(f"Failed to logout all sessions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to logout all sessions"
        )

@router.get("/status")
async def auth_status(
    current_user: Optional[User] = Depends(get_current_user)
):
    """Check authentication status"""
    if current_user:
        return {
            "authenticated": True,
            "user": UserResponse(**current_user.to_dict())
        }
    else:
        return {
            "authenticated": False,
            "user": None
        }

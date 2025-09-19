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

@router.get("/test-debug")
async def test_debug():
    """Test endpoint to verify debug logging is working"""
    logger.info("TEST: Debug logging is working!")
    return {"message": "Debug test successful", "status": "working"}

@router.post("/login-simple")
async def login_simple(
    request: Request,
    response: Response,
    login_data: dict
):
    """Simple login endpoint without database dependencies for testing"""
    username = login_data.get("username")
    password = login_data.get("password") 
    device_name = login_data.get("device_name")
    device_type = login_data.get("device_type", "admin")
    
    logger.info(f"LOGIN-SIMPLE: Starting login attempt for username: {username}")
    
    try:
        # Manual database connection
        from models.database import engine, SessionLocal
        from sqlalchemy.orm import sessionmaker
        
        if engine is None:
            logger.error("LOGIN-SIMPLE: Engine is None - database not initialized")
            return {"success": False, "message": "Database not initialized"}
        
        # Create manual session
        Session = sessionmaker(bind=engine)
        db = Session()
        
        try:
            from services.auth_service import AuthService
            auth_service = AuthService(db)
            
            # Test authentication
            user = auth_service.authenticate_user(username, password)
            if not user:
                logger.warning(f"LOGIN-SIMPLE: Authentication failed for: {username}")
                return {"success": False, "message": "Invalid credentials"}
            
            logger.info(f"LOGIN-SIMPLE: Authentication successful for: {user.username}")
            
            # Test session creation
            session, csrf_token = auth_service.create_session_with_csrf(
                user=user,
                user_agent=request.headers.get("user-agent"),
                ip_address=request.client.host if request.client else None,
                device_name=device_name,
                device_type=device_type
            )
            
            logger.info(f"LOGIN-SIMPLE: Session created successfully - token: {session.session_token[:8]}...")
            
            # Test cookie setting
            cookie_manager.set_auth_cookies(
                response=response,
                session_token=session.session_token,
                refresh_token=session.refresh_token,
                csrf_token=csrf_token
            )
            
            logger.info(f"LOGIN-SIMPLE: Cookies set successfully")
            
            return {
                "success": True, 
                "message": "Login successful",
                "session_token": session.session_token[:8] + "...",
                "user": user.username
            }
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"LOGIN-SIMPLE: Error: {e}")
        import traceback
        logger.error(f"LOGIN-SIMPLE: Traceback: {traceback.format_exc()}")
        return {"success": False, "message": f"Error: {str(e)}"}

@router.get("/me-simple")
async def get_current_user_simple(request: Request):
    """Simple auth check endpoint without dependencies for testing"""
    logger.info("ME-SIMPLE: Starting auth check...")
    
    try:
        # Manual database connection
        from models.database import engine
        from sqlalchemy.orm import sessionmaker
        
        if engine is None:
            logger.error("ME-SIMPLE: Engine is None - database not initialized")
            return {"authenticated": False, "message": "Database not initialized"}
        
        # Create manual session
        Session = sessionmaker(bind=engine)
        db = Session()
        
        try:
            from utils.cookies import cookie_manager
            from services.auth_service import AuthService
            
            # Get cookies manually
            session_token, refresh_token, csrf_token = cookie_manager.get_auth_cookies(request)
            logger.info(f"ME-SIMPLE: Cookies - session: {'present' if session_token else 'missing'}")
            
            if not session_token:
                logger.warning("ME-SIMPLE: No session token found")
                return {"authenticated": False, "message": "No session token"}
            
            # Check session manually
            auth_service = AuthService(db)
            user = auth_service.get_user_by_session(session_token)
            
            if not user:
                logger.warning(f"ME-SIMPLE: Invalid session token: {session_token[:8]}...")
                return {"authenticated": False, "message": "Invalid session"}
            
            logger.info(f"ME-SIMPLE: Authentication successful for: {user.username}")
            return {
                "authenticated": True,
                "user": user.username,
                "session_token": session_token[:8] + "..."
            }
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"ME-SIMPLE: Error: {e}")
        import traceback
        logger.error(f"ME-SIMPLE: Traceback: {traceback.format_exc()}")
        return {"authenticated": False, "message": f"Error: {str(e)}"}

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
    logger.info(f"LOGIN: Starting login attempt for username: {login_data.username}")
    
    try:
        logger.info("LOGIN: Creating AuthService...")
        auth_service = AuthService(db)
        
        # Authenticate user
        logger.info(f"LOGIN: Calling authenticate_user for: {login_data.username}")
        user = auth_service.authenticate_user(login_data.username, login_data.password)
        logger.info(f"LOGIN: Authentication result: {'Success' if user else 'Failed'}")
        
        if not user:
            logger.warning(f"LOGIN: Authentication failed for username: {login_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )
        
        # Create session
        logger.info("LOGIN: Preparing session creation...")
        user_agent = request.headers.get("user-agent")
        ip_address = request.client.host if request.client else None
        logger.info(f"LOGIN: User-Agent: {user_agent}, IP: {ip_address}")
        
        logger.info("LOGIN: Calling create_session_with_csrf...")
        session, csrf_token = auth_service.create_session_with_csrf(
            user=user,
            user_agent=user_agent,
            ip_address=ip_address,
            device_name=login_data.device_name,
            device_type=login_data.device_type
        )
        logger.info(f"LOGIN: Session created - ID: {session.id}, token: {session.session_token[:8]}...")
        
        # Debug CSRF token generation
        logger.info(f"LOGIN: Generated CSRF token: {csrf_token}")
        
        # Set authentication cookies
        logger.info("LOGIN: Setting authentication cookies...")
        cookie_manager.set_auth_cookies(
            response=response,
            session_token=session.session_token,
            refresh_token=session.refresh_token,
            csrf_token=csrf_token
        )
        
        logger.info(f"LOGIN: User {user.username} logged in successfully")
        
        return LoginResponse(
            success=True,
            message="Login successful",
            user=UserResponse(**user.to_dict())
        )
        
    except HTTPException as he:
        logger.info(f"LOGIN: HTTPException raised - status: {he.status_code}, detail: {he.detail}")
        raise
    except Exception as e:
        logger.error(f"LOGIN: Unexpected error during login: {e}")
        logger.error(f"LOGIN: Exception type: {type(e).__name__}")
        import traceback
        logger.error(f"LOGIN: Traceback: {traceback.format_exc()}")
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

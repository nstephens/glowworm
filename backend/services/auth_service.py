from sqlalchemy.orm import Session
from typing import Optional, Tuple
from datetime import datetime, timedelta
import logging

from models.user import User, UserRole
from models.session import UserSession
from utils.auth import password_manager
from utils.cookies import cookie_manager

logger = logging.getLogger(__name__)

class AuthService:
    """Authentication service for managing users and sessions"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_first_admin_user(self, username: str, password: str) -> User:
        """Create the first admin user (super admin)"""
        # Check if any users exist
        existing_user = self.db.query(User).first()
        if existing_user:
            raise ValueError("Admin user already exists")
        
        # Create super admin user
        hashed_password = password_manager.hash_password(password)
        user = User(
            username=username,
            hashed_password=hashed_password,
            role=UserRole.SUPER_ADMIN,
            is_first_user=True,
            display_name=username
        )
        
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        
        logger.info(f"Created first admin user: {username}")
        return user
    
    def create_user(self, username: str, password: str, email: Optional[str] = None, 
                   role: UserRole = UserRole.USER, display_name: Optional[str] = None) -> User:
        """Create a new user"""
        # Check if username already exists
        existing_user = self.db.query(User).filter(User.username == username).first()
        if existing_user:
            raise ValueError("Username already exists")
        
        # Check if email already exists (if provided)
        if email:
            existing_email = self.db.query(User).filter(User.email == email).first()
            if existing_email:
                raise ValueError("Email already exists")
        
        hashed_password = password_manager.hash_password(password)
        user = User(
            username=username,
            email=email,
            hashed_password=hashed_password,
            role=role,
            display_name=display_name or username
        )
        
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        
        logger.info(f"Created user: {username} with role: {role}")
        return user
    
    def authenticate_user(self, username: str, password: str) -> Optional[User]:
        """Authenticate user with username and password"""
        user = self.db.query(User).filter(User.username == username).first()
        
        if not user or not user.is_active:
            return None
        
        if not password_manager.verify_password(password, user.hashed_password):
            return None
        
        # Update last login
        user.last_login = datetime.utcnow()
        self.db.commit()
        
        return user
    
    def create_session(self, user: User, user_agent: Optional[str] = None, 
                      ip_address: Optional[str] = None, device_name: Optional[str] = None,
                      device_type: str = "admin") -> UserSession:
        """Create a new user session"""
        # Deactivate old sessions for the same device type
        self.db.query(UserSession).filter(
            UserSession.user_id == user.id,
            UserSession.device_type == device_type,
            UserSession.is_active == True
        ).update({"is_active": False})
        
        # Create new session
        session = UserSession.create_session(
            user_id=user.id,
            user_agent=user_agent,
            ip_address=ip_address,
            device_name=device_name,
            device_type=device_type
        )
        
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        
        logger.info(f"Created session for user: {user.username}, device_type: {device_type}")
        return session
    
    def get_session_by_token(self, session_token: str) -> Optional[UserSession]:
        """Get active session by token"""
        session = self.db.query(UserSession).filter(
            UserSession.session_token == session_token,
            UserSession.is_active == True
        ).first()
        
        if not session or session.is_expired():
            return None
        
        # Update last used timestamp
        session.last_used = datetime.utcnow()
        self.db.commit()
        
        return session
    
    def get_user_by_session(self, session_token: str) -> Optional[User]:
        """Get user by session token"""
        session = self.get_session_by_token(session_token)
        if not session:
            return None
        
        return session.user
    
    def refresh_session(self, refresh_token: str) -> Optional[Tuple[UserSession, User]]:
        """Refresh session using refresh token"""
        session = self.db.query(UserSession).filter(
            UserSession.refresh_token == refresh_token,
            UserSession.is_active == True
        ).first()
        
        if not session or session.is_expired():
            return None
        
        # Extend session
        session.extend_session()
        self.db.commit()
        
        return session, session.user
    
    def logout_session(self, session_token: str) -> bool:
        """Logout a specific session"""
        session = self.db.query(UserSession).filter(
            UserSession.session_token == session_token
        ).first()
        
        if session:
            session.is_active = False
            self.db.commit()
            logger.info(f"Logged out session: {session_token}")
            return True
        
        return False
    
    def logout_all_user_sessions(self, user_id: int) -> int:
        """Logout all sessions for a user"""
        result = self.db.query(UserSession).filter(
            UserSession.user_id == user_id,
            UserSession.is_active == True
        ).update({"is_active": False})
        
        self.db.commit()
        logger.info(f"Logged out {result} sessions for user_id: {user_id}")
        return result
    
    def cleanup_expired_sessions(self) -> int:
        """Clean up expired sessions"""
        result = self.db.query(UserSession).filter(
            UserSession.expires_at < datetime.utcnow()
        ).update({"is_active": False})
        
        self.db.commit()
        logger.info(f"Cleaned up {result} expired sessions")
        return result
    
    def get_user_sessions(self, user_id: int) -> list[UserSession]:
        """Get all active sessions for a user"""
        return self.db.query(UserSession).filter(
            UserSession.user_id == user_id,
            UserSession.is_active == True
        ).all()
    
    def change_password(self, user: User, old_password: str, new_password: str) -> bool:
        """Change user password"""
        # Verify old password
        if not password_manager.verify_password(old_password, user.hashed_password):
            return False
        
        # Validate new password
        validation = password_manager.validate_password_strength(new_password)
        if not validation["is_valid"]:
            raise ValueError(f"Password validation failed: {', '.join(validation['errors'])}")
        
        # Update password
        user.hashed_password = password_manager.hash_password(new_password)
        self.db.commit()
        
        # Logout all other sessions
        self.logout_all_user_sessions(user.id)
        
        logger.info(f"Password changed for user: {user.username}")
        return True
    
    def reset_password(self, user: User, new_password: str) -> bool:
        """Reset user password (admin function)"""
        # Validate new password
        validation = password_manager.validate_password_strength(new_password)
        if not validation["is_valid"]:
            raise ValueError(f"Password validation failed: {', '.join(validation['errors'])}")
        
        # Update password
        user.hashed_password = password_manager.hash_password(new_password)
        self.db.commit()
        
        # Logout all sessions
        self.logout_all_user_sessions(user.id)
        
        logger.info(f"Password reset for user: {user.username}")
        return True

    def create_session_with_csrf(self, user: User, user_agent: Optional[str] = None, 
                                ip_address: Optional[str] = None, device_name: Optional[str] = None,
                                device_type: str = "admin") -> Tuple[UserSession, str]:
        """Create a new user session with CSRF token"""
        # Create session
        session = self.create_session(user, user_agent, ip_address, device_name, device_type)
        
        # Generate CSRF token
        csrf_token = cookie_manager.generate_csrf_token()
        
        return session, csrf_token
    
    def rotate_session(self, user: User, current_session_token: str, 
                      user_agent: Optional[str] = None, ip_address: Optional[str] = None) -> Tuple[UserSession, str]:
        """Rotate session token for enhanced security"""
        # Get current session
        current_session = self.get_session_by_token(current_session_token)
        if not current_session or current_session.user_id != user.id:
            raise ValueError("Invalid session")
        
        # Deactivate current session
        current_session.is_active = False
        self.db.commit()
        
        # Create new session with same parameters
        new_session = self.create_session(
            user=user,
            user_agent=user_agent or current_session.user_agent,
            ip_address=ip_address or current_session.ip_address,
            device_name=current_session.device_name,
            device_type=current_session.device_type
        )
        
        # Generate new CSRF token
        csrf_token = cookie_manager.generate_csrf_token()
        
        logger.info(f"Rotated session for user: {user.username}")
        return new_session, csrf_token
    
    def invalidate_user_sessions(self, user: User, device_type: Optional[str] = None) -> int:
        """Invalidate all sessions for a user (or specific device type)"""
        query = self.db.query(UserSession).filter(
            UserSession.user_id == user.id,
            UserSession.is_active == True
        )
        
        if device_type:
            query = query.filter(UserSession.device_type == device_type)
        
        sessions = query.all()
        for session in sessions:
            session.is_active = False
        
        self.db.commit()
        
        logger.info(f"Invalidated {len(sessions)} sessions for user: {user.username}")
        return len(sessions)
    
    def cleanup_expired_sessions(self) -> int:
        """Clean up expired sessions"""
        expired_sessions = self.db.query(UserSession).filter(
            UserSession.is_active == True,
            UserSession.expires_at < datetime.utcnow()
        ).all()
        
        for session in expired_sessions:
            session.is_active = False
        
        self.db.commit()
        
        if expired_sessions:
            logger.info(f"Cleaned up {len(expired_sessions)} expired sessions")
        
        return len(expired_sessions)

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base
import secrets
import string
from datetime import datetime, timedelta

class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    session_token = Column(String(255), unique=True, index=True, nullable=False)
    refresh_token = Column(String(255), unique=True, index=True, nullable=True)
    
    # Session metadata
    is_active = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_used = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Client information
    user_agent = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    
    # Device information for display devices
    device_name = Column(String(100), nullable=True)
    device_type = Column(String(50), nullable=True)  # 'admin', 'display', 'mobile'
    
    # Relationships
    user = relationship("User", back_populates="sessions")

    def __repr__(self):
        return f"<UserSession(id={self.id}, user_id={self.user_id}, device_type='{self.device_type}')>"

    @classmethod
    def generate_session_token(cls) -> str:
        """Generate a secure session token"""
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(64))

    @classmethod
    def generate_refresh_token(cls) -> str:
        """Generate a secure refresh token"""
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(32))

    @classmethod
    def create_session(cls, user_id: int, expires_days: int = 30, 
                      user_agent: str = None, ip_address: str = None,
                      device_name: str = None, device_type: str = "admin") -> "UserSession":
        """Create a new user session"""
        now = datetime.utcnow()
        expires_at = now + timedelta(days=expires_days)
        
        return cls(
            user_id=user_id,
            session_token=cls.generate_session_token(),
            refresh_token=cls.generate_refresh_token(),
            expires_at=expires_at,
            user_agent=user_agent,
            ip_address=ip_address,
            device_name=device_name,
            device_type=device_type
        )

    def is_expired(self) -> bool:
        """Check if session is expired"""
        return datetime.utcnow() > self.expires_at

    def extend_session(self, days: int = 30):
        """Extend session expiration"""
        self.expires_at = datetime.utcnow() + timedelta(days=days)
        self.last_used = datetime.utcnow()

    def to_dict(self):
        """Convert session to dictionary (excluding sensitive data)"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "is_active": self.is_active,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_used": self.last_used.isoformat() if self.last_used else None,
            "device_name": self.device_name,
            "device_type": self.device_type,
        }

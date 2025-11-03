from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base
import enum

class UserLogLevel(str, enum.Enum):
    """User log level enumeration"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"

class UserLogAction(str, enum.Enum):
    """Common user actions to track"""
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    VIEW = "VIEW"
    UPLOAD = "UPLOAD"
    DOWNLOAD = "DOWNLOAD"
    ERROR = "ERROR"
    OTHER = "OTHER"

class UserLog(Base):
    """Logs from authenticated users in the webapp"""
    __tablename__ = "user_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)  # Nullable for anonymous actions
    log_level = Column(Enum(UserLogLevel, values_callable=lambda x: [e.value for e in x]), nullable=False, index=True, default=UserLogLevel.INFO)
    action = Column(Enum(UserLogAction, values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    message = Column(Text, nullable=False)
    context = Column(JSON, nullable=True)  # Additional structured data
    url = Column(String(500), nullable=True)  # Page URL where action occurred
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Relationships
    user = relationship("User", backref="logs")

    def __repr__(self):
        return f"<UserLog(id={self.id}, user_id={self.user_id}, action='{self.action}', message='{self.message[:50]}...')>"

    def to_dict(self):
        """Convert log to dictionary"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "username": self.user.username if self.user else None,
            "log_level": self.log_level.value.lower(),
            "action": self.action.value.lower(),
            "message": self.message,
            "context": self.context,
            "url": self.url,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


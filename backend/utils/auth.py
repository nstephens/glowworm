from passlib.context import CryptContext
from passlib.hash import bcrypt
import secrets
import string
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__default_rounds=12)

class PasswordManager:
    """Manage password hashing and verification"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using bcrypt
        
        Handles passwords longer than 72 bytes by pre-hashing with SHA-256.
        This allows arbitrarily long passwords while staying within bcrypt's limit.
        """
        try:
            # If password is longer than 72 bytes, pre-hash it with SHA-256
            if len(password.encode('utf-8')) > 72:
                import hashlib
                password = hashlib.sha256(password.encode('utf-8')).hexdigest()
            
            return pwd_context.hash(password)
        except Exception as e:
            logger.error(f"Failed to hash password: {e}")
            raise
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash
        
        Handles long passwords by pre-hashing with SHA-256 if needed.
        """
        try:
            # If password is longer than 72 bytes, pre-hash it (same as during hashing)
            if len(plain_password.encode('utf-8')) > 72:
                import hashlib
                plain_password = hashlib.sha256(plain_password.encode('utf-8')).hexdigest()
            
            return pwd_context.verify(plain_password, hashed_password)
        except Exception as e:
            logger.error(f"Failed to verify password: {e}")
            return False
    
    @staticmethod
    def generate_secure_password(length: int = 12) -> str:
        """Generate a secure random password"""
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        return ''.join(secrets.choice(alphabet) for _ in range(length))
    
    @staticmethod
    def validate_password_strength(password: str) -> dict:
        """Validate password strength and return feedback"""
        feedback = {
            "is_valid": True,
            "errors": [],
            "strength": "weak"
        }
        
        if len(password) < 8:
            feedback["errors"].append("Password must be at least 8 characters long")
            feedback["is_valid"] = False
        
        if not any(c.isupper() for c in password):
            feedback["errors"].append("Password must contain at least one uppercase letter")
        
        if not any(c.islower() for c in password):
            feedback["errors"].append("Password must contain at least one lowercase letter")
        
        if not any(c.isdigit() for c in password):
            feedback["errors"].append("Password must contain at least one number")
        
        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            feedback["errors"].append("Password must contain at least one special character")
        
        # Determine strength
        if len(password) >= 12 and len(feedback["errors"]) == 0:
            feedback["strength"] = "strong"
        elif len(password) >= 8 and len(feedback["errors"]) <= 1:
            feedback["strength"] = "medium"
        
        return feedback

# Global password manager instance
password_manager = PasswordManager()

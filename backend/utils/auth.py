import bcrypt as bcrypt_lib
import secrets
import string
from typing import Optional
import logging
import hashlib

logger = logging.getLogger(__name__)

# Bcrypt rounds for hashing (higher = more secure but slower)
BCRYPT_ROUNDS = 12

class PasswordManager:
    """Manage password hashing and verification"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using bcrypt
        
        Always pre-hashes with SHA-256 to avoid bcrypt's 72 byte limit.
        This allows passwords of any length while maintaining security.
        """
        try:
            # Always pre-hash to avoid any length issues and ensure consistency
            password_bytes = password.encode('utf-8')
            prehashed = hashlib.sha256(password_bytes).hexdigest()
            
            # Now hash with bcrypt
            salt = bcrypt_lib.gensalt(rounds=BCRYPT_ROUNDS)
            hashed = bcrypt_lib.hashpw(prehashed.encode('utf-8'), salt)
            
            return hashed.decode('utf-8')
        except Exception as e:
            logger.error(f"Failed to hash password: {e}")
            raise
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash
        
        Supports both new (SHA-256 pre-hashed) and legacy (passlib) password hashes
        for backward compatibility during migration.
        """
        try:
            # Try new method: SHA-256 pre-hash + bcrypt
            password_bytes = plain_password.encode('utf-8')
            prehashed = hashlib.sha256(password_bytes).hexdigest()
            
            if bcrypt_lib.checkpw(prehashed.encode('utf-8'), hashed_password.encode('utf-8')):
                return True
            
            # Fallback: Try legacy passlib method (for passwords created before migration)
            # This allows existing users to still log in
            try:
                from passlib.context import CryptContext
                pwd_context_legacy = CryptContext(schemes=["bcrypt"], deprecated="auto")
                if pwd_context_legacy.verify(plain_password, hashed_password):
                    logger.info("Password verified using legacy passlib method")
                    return True
            except Exception:
                pass
            
            return False
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

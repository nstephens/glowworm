import secrets
import base64
import hashlib
import requests
from typing import Optional, Dict, Any
from jose import jwt, JWTError
from config.settings import settings
import logging

logger = logging.getLogger(__name__)

class GoogleOAuthService:
    """Service for handling Google OAuth2 authentication"""
    
    def __init__(self):
        self.client_id = settings.google_client_id
        self.client_secret = settings.google_client_secret
        self.redirect_uri = f"http://localhost:8001/api/auth/google/callback"
        self.auth_url = "https://accounts.google.com/o/oauth2/v2/auth"
        self.token_url = "https://oauth2.googleapis.com/token"
        self.userinfo_url = "https://openidconnect.googleapis.com/v1/userinfo"
        
        # Admin email domains or specific emails that can access admin features
        self.admin_emails = [
            "nickstephens@gmail.com",  # Default admin email
            # Add more admin emails as needed
        ]
    
    def generate_code_verifier(self) -> str:
        """Generate a cryptographically secure code verifier for PKCE"""
        return base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b'=').decode('utf-8')
    
    def generate_code_challenge(self, verifier: str) -> str:
        """Generate code challenge from verifier for PKCE"""
        digest = hashlib.sha256(verifier.encode('utf-8')).digest()
        return base64.urlsafe_b64encode(digest).rstrip(b'=').decode('utf-8')
    
    def generate_state(self) -> str:
        """Generate a random state parameter for CSRF protection"""
        return secrets.token_urlsafe(32)
    
    def get_authorization_url(self, state: str, code_verifier: str) -> str:
        """Generate Google OAuth2 authorization URL with PKCE"""
        code_challenge = self.generate_code_challenge(code_verifier)
        
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "access_type": "offline",
            "prompt": "consent",
            "state": state
        }
        
        # Build URL with parameters
        param_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{self.auth_url}?{param_string}"
    
    def exchange_code_for_tokens(self, code: str, code_verifier: str) -> Optional[Dict[str, Any]]:
        """Exchange authorization code for access and ID tokens"""
        try:
            data = {
                "code": code,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "redirect_uri": self.redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": code_verifier
            }
            
            response = requests.post(self.token_url, data=data, timeout=10)
            response.raise_for_status()
            
            return response.json()
        except requests.RequestException as e:
            logger.error(f"Failed to exchange code for tokens: {e}")
            return None
    
    def get_user_info(self, access_token: str) -> Optional[Dict[str, Any]]:
        """Get user information from Google using access token"""
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            response = requests.get(self.userinfo_url, headers=headers, timeout=10)
            response.raise_for_status()
            
            return response.json()
        except requests.RequestException as e:
            logger.error(f"Failed to get user info: {e}")
            return None
    
    def verify_id_token(self, id_token: str) -> Optional[Dict[str, Any]]:
        """Verify and decode the ID token from Google"""
        try:
            # For development, we'll decode without verification
            # In production, you should verify the signature
            decoded = jwt.get_unverified_claims(id_token)
            
            # Basic validation
            if decoded.get("iss") != "https://accounts.google.com":
                logger.error("Invalid token issuer")
                return None
            
            if decoded.get("aud") != self.client_id:
                logger.error("Invalid token audience")
                return None
            
            return decoded
        except JWTError as e:
            logger.error(f"Failed to verify ID token: {e}")
            return None
    
    def is_admin_user(self, email: str) -> bool:
        """Check if the user email is authorized for admin access"""
        if not email:
            return False
        
        # Check if email is in admin list
        if email in self.admin_emails:
            return True
        
        # Check if email domain is admin domain (for future use)
        # domain = email.split('@')[1] if '@' in email else ''
        # if domain in self.admin_domains:
        #     return True
        
        return False
    
    def create_user_from_google(self, user_info: Dict[str, Any]) -> Dict[str, Any]:
        """Create user data structure from Google user info"""
        return {
            "username": user_info.get("email", "").split("@")[0],  # Use email prefix as username
            "email": user_info.get("email", ""),
            "display_name": user_info.get("name", ""),
            "avatar_url": user_info.get("picture", ""),
            "google_id": user_info.get("sub", ""),
            "is_google_user": True,
            "is_admin": self.is_admin_user(user_info.get("email", ""))
        }

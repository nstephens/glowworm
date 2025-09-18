from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional, List

from models.user import User, UserRole
from utils.logger import get_logger
from utils.auth import password_manager

logger = get_logger(__name__)

class UserService:
    def __init__(self, db: Session):
        self.db = db

    def get_all_users(self) -> List[User]:
        """Get all users"""
        return self.db.query(User).all()

    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        return self.db.query(User).filter(User.id == user_id).first()

    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username"""
        return self.db.query(User).filter(User.username == username).first()

    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        return self.db.query(User).filter(User.email == email).first()

    def create_user(
        self,
        username: str,
        password: str,
        email: Optional[str] = None,
        role: UserRole = UserRole.USER,
        display_name: Optional[str] = None
    ) -> User:
        """Create a new user"""
        try:
            hashed_password = password_manager.hash_password(password)
            
            new_user = User(
                username=username,
                email=email,
                hashed_password=hashed_password,
                role=role,
                display_name=display_name or username
            )
            
            self.db.add(new_user)
            self.db.commit()
            self.db.refresh(new_user)
            
            logger.info(f"Created new user: {username} with role: {role}")
            return new_user
            
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Failed to create user {username}: {str(e)}")
            raise Exception("User creation failed due to constraint violation")

    def update_user(self, user_id: int, update_data: dict) -> User:
        """Update user information"""
        try:
            user = self.get_user_by_id(user_id)
            if not user:
                raise Exception("User not found")
            
            # Update allowed fields
            for field, value in update_data.items():
                if hasattr(user, field) and value is not None:
                    setattr(user, field, value)
            
            self.db.commit()
            self.db.refresh(user)
            
            logger.info(f"Updated user: {user.username}")
            return user
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to update user {user_id}: {str(e)}")
            raise Exception(f"Failed to update user: {str(e)}")

    def update_user_password(self, user_id: int, new_password: str) -> User:
        """Update user password"""
        try:
            user = self.get_user_by_id(user_id)
            if not user:
                raise Exception("User not found")
            
            hashed_password = password_manager.hash_password(new_password)
            user.hashed_password = hashed_password
            
            self.db.commit()
            self.db.refresh(user)
            
            logger.info(f"Updated password for user: {user.username}")
            return user
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to update password for user {user_id}: {str(e)}")
            raise Exception(f"Failed to update password: {str(e)}")

    def delete_user(self, user_id: int) -> bool:
        """Delete a user"""
        try:
            user = self.get_user_by_id(user_id)
            if not user:
                raise Exception("User not found")
            
            self.db.delete(user)
            self.db.commit()
            
            logger.info(f"Deleted user: {user.username}")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to delete user {user_id}: {str(e)}")
            raise Exception(f"Failed to delete user: {str(e)}")

    def toggle_user_active(self, user_id: int) -> User:
        """Toggle user active status"""
        try:
            user = self.get_user_by_id(user_id)
            if not user:
                raise Exception("User not found")
            
            user.is_active = not user.is_active
            self.db.commit()
            self.db.refresh(user)
            
            logger.info(f"Toggled active status for user: {user.username} to {user.is_active}")
            return user
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to toggle active status for user {user_id}: {str(e)}")
            raise Exception(f"Failed to toggle user status: {str(e)}")

    def get_users_by_role(self, role: UserRole) -> List[User]:
        """Get all users with a specific role"""
        return self.db.query(User).filter(User.role == role).all()

    def get_active_users(self) -> List[User]:
        """Get all active users"""
        return self.db.query(User).filter(User.is_active == True).all()

    def count_users(self) -> int:
        """Count total users"""
        return self.db.query(User).count()

    def count_users_by_role(self, role: UserRole) -> int:
        """Count users by role"""
        return self.db.query(User).filter(User.role == role).count()

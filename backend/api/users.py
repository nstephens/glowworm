from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, EmailStr

from models.database import get_db
from models.user import User, UserRole
from services.auth_service import AuthService
from services.user_service import UserService
from utils.middleware import AuthMiddleware

router = APIRouter(prefix="/api/users", tags=["users"])

# Pydantic models
class UserCreateRequest(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    password: str
    role: UserRole = UserRole.USER
    display_name: Optional[str] = None

class UserUpdateRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    display_name: Optional[str] = None
    is_active: Optional[bool] = None

class UserPasswordUpdateRequest(BaseModel):
    current_password: str
    new_password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]
    role: str
    is_active: bool
    display_name: Optional[str]
    avatar_url: Optional[str]
    created_at: str
    updated_at: str
    last_login: Optional[str]

    class Config:
        from_attributes = True

@router.get("/", response_model=List[UserResponse])
async def get_users(
    current_user: User = Depends(AuthMiddleware.require_admin),
    db: Session = Depends(get_db)
):
    """Get all users (admin only)"""
    user_service = UserService(db)
    users = user_service.get_all_users()
    return [UserResponse(**user.to_dict()) for user in users]

@router.get("/me", response_model=UserResponse)
async def get_current_user(
    current_user: User = Depends(AuthMiddleware.require_auth),
    db: Session = Depends(get_db)
):
    """Get current user profile"""
    return UserResponse(**current_user.to_dict())

@router.post("/", response_model=UserResponse)
async def create_user(
    user_data: UserCreateRequest,
    current_user: User = Depends(AuthMiddleware.require_admin),
    db: Session = Depends(get_db)
):
    """Create a new user (admin only)"""
    user_service = UserService(db)
    
    # Check if username already exists
    if user_service.get_user_by_username(user_data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Check if email already exists (if provided)
    if user_data.email and user_service.get_user_by_email(user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists"
        )
    
    try:
        new_user = user_service.create_user(
            username=user_data.username,
            email=user_data.email,
            password=user_data.password,
            role=user_data.role,
            display_name=user_data.display_name
        )
        return UserResponse(**new_user.to_dict())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdateRequest,
    current_user: User = Depends(AuthMiddleware.require_auth),
    db: Session = Depends(get_db)
):
    """Update user (admin can update anyone, users can update themselves)"""
    user_service = UserService(db)
    target_user = user_service.get_user_by_id(user_id)
    
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check permissions
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own profile"
        )
    
    # Non-admin users cannot change roles
    if not current_user.is_admin and user_data.role is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot change user roles"
        )
    
    # Prevent non-admin users from deactivating themselves
    if not current_user.is_admin and user_id == current_user.id and user_data.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot deactivate your own account"
        )
    
    try:
        updated_user = user_service.update_user(user_id, user_data.dict(exclude_unset=True))
        return UserResponse(**updated_user.to_dict())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user: {str(e)}"
        )

@router.put("/{user_id}/password")
async def update_user_password(
    user_id: int,
    password_data: UserPasswordUpdateRequest,
    current_user: User = Depends(AuthMiddleware.require_auth),
    db: Session = Depends(get_db)
):
    """Update user password (admin can update anyone, users can update themselves)"""
    user_service = UserService(db)
    target_user = user_service.get_user_by_id(user_id)
    
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check permissions
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own password"
        )
    
    try:
        # Verify current password for non-admin users
        if not current_user.is_admin:
            auth_service = AuthService(db)
            if not auth_service.verify_password(password_data.current_password, target_user.hashed_password):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Current password is incorrect"
                )
        
        user_service.update_user_password(user_id, password_data.new_password)
        return {"success": True, "message": "Password updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update password: {str(e)}"
        )

@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(AuthMiddleware.require_admin),
    db: Session = Depends(get_db)
):
    """Delete a user (admin only)"""
    user_service = UserService(db)
    target_user = user_service.get_user_by_id(user_id)
    
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent deleting the current user
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account"
        )
    
    # Prevent deleting super admin users
    if target_user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete super admin users"
        )
    
    try:
        user_service.delete_user(user_id)
        return {"success": True, "message": "User deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete user: {str(e)}"
        )

@router.post("/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: int,
    current_user: User = Depends(AuthMiddleware.require_admin),
    db: Session = Depends(get_db)
):
    """Toggle user active status (admin only)"""
    user_service = UserService(db)
    target_user = user_service.get_user_by_id(user_id)
    
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent deactivating the current user
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account"
        )
    
    try:
        updated_user = user_service.toggle_user_active(user_id)
        return UserResponse(**updated_user.to_dict())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to toggle user status: {str(e)}"
        )

class AdminPasswordResetRequest(BaseModel):
    new_password: str

@router.put("/{user_id}/reset-password")
async def admin_reset_user_password(
    user_id: int,
    request: AdminPasswordResetRequest,
    current_user: User = Depends(AuthMiddleware.require_admin),
    db: Session = Depends(get_db)
):
    """Reset a user's password (admin only)"""
    user_service = UserService(db)
    target_user = user_service.get_user_by_id(user_id)
    
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Regular users cannot reset their own password through this endpoint
    if current_user.role == UserRole.USER and user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Users cannot reset their own password. Use the change password feature instead."
        )
    
    try:
        user_service.update_user_password(user_id, request.new_password)
        return {"success": True, "message": "Password reset successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset password: {str(e)}"
        )

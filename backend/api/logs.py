from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging

from models.database import get_db
from models.user_log import UserLog, UserLogLevel, UserLogAction
from models.user import User
from utils.middleware import require_admin, get_current_user
from utils.file_logger import read_log_file, write_frontend_log

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/logs", tags=["logs"])

# Pydantic models
class FrontendLogRequest(BaseModel):
    log_level: str  # "debug", "info", "warning", "error"
    message: str
    context: Optional[dict] = None
    url: Optional[str] = None

class UserLogRequest(BaseModel):
    log_level: str  # "debug", "info", "warning", "error"
    action: str  # "login", "create", "update", etc.
    message: str
    context: Optional[dict] = None
    url: Optional[str] = None

class LogLineResponse(BaseModel):
    line_number: int
    timestamp: str
    level: str
    logger_name: str
    message: str

class UserLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    username: Optional[str]
    log_level: str
    action: str
    message: str
    context: Optional[dict]
    url: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    created_at: str

    @classmethod
    def from_log(cls, log: UserLog) -> "UserLogResponse":
        return cls(**log.to_dict())

# Frontend log endpoints
@router.post("/frontend")
async def submit_frontend_log(
    request: Request,
    log_data: FrontendLogRequest
):
    """Submit a log entry from the frontend (no auth required for logging errors)"""
    try:
        # Write to frontend log file
        write_frontend_log(
            log_level=log_data.log_level,
            message=log_data.message,
            context=log_data.context
        )
        
        return {"success": True, "message": "Log submitted successfully"}
        
    except Exception as e:
        logger.error(f"Submit frontend log failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit log")

@router.get("/frontend")
async def get_frontend_logs(
    lines: int = Query(1000, ge=1, le=10000, description="Number of lines to read from end of file"),
    current_user: User = Depends(require_admin),
):
    """Get frontend logs from file (admin only)"""
    try:
        log_lines = read_log_file("frontend", lines)
        
        # Parse log lines into structured format
        parsed_logs = []
        for i, line in enumerate(log_lines):
            try:
                parts = line.strip().split(' - ', 3)
                if len(parts) >= 3:
                    parsed_logs.append({
                        "line_number": i + 1,
                        "timestamp": parts[0] if len(parts) > 0 else "",
                        "level": parts[1] if len(parts) > 1 else "",
                        "message": parts[2] if len(parts) > 2 else line.strip()
                    })
                else:
                    parsed_logs.append({
                        "line_number": i + 1,
                        "timestamp": "",
                        "level": "",
                        "message": line.strip()
                    })
            except Exception:
                parsed_logs.append({
                    "line_number": i + 1,
                    "timestamp": "",
                    "level": "",
                    "message": line.strip()
                })
        
        return {"success": True, "logs": parsed_logs, "total": len(parsed_logs)}
        
    except Exception as e:
        logger.error(f"Get frontend logs failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get frontend logs")

# Backend log endpoints
@router.get("/backend")
async def get_backend_logs(
    lines: int = Query(1000, ge=1, le=10000, description="Number of lines to read from end of file"),
    current_user: User = Depends(require_admin),
):
    """Get backend logs from file (admin only)"""
    try:
        log_lines = read_log_file("backend", lines)
        
        # Parse log lines into structured format
        parsed_logs = []
        for i, line in enumerate(log_lines):
            try:
                # Format: 2025-11-03 02:00:00 - logger.name - LEVEL - message
                parts = line.strip().split(' - ', 3)
                if len(parts) >= 4:
                    parsed_logs.append({
                        "line_number": i + 1,
                        "timestamp": parts[0],
                        "logger_name": parts[1],
                        "level": parts[2],
                        "message": parts[3]
                    })
                else:
                    parsed_logs.append({
                        "line_number": i + 1,
                        "timestamp": "",
                        "logger_name": "",
                        "level": "",
                        "message": line.strip()
                    })
            except Exception:
                parsed_logs.append({
                    "line_number": i + 1,
                    "timestamp": "",
                    "logger_name": "",
                    "level": "",
                    "message": line.strip()
                })
        
        return {"success": True, "logs": parsed_logs, "total": len(parsed_logs)}
        
    except Exception as e:
        logger.error(f"Get backend logs failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get backend logs")

# User log endpoints
@router.post("/user")
async def submit_user_log(
    request: Request,
    log_data: UserLogRequest,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit a log entry from an authenticated user (or anonymous)"""
    try:
        # Validate log level
        try:
            log_level_enum = UserLogLevel(log_data.log_level.upper())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid log level: {log_data.log_level}")
        
        # Validate action
        try:
            action_enum = UserLogAction(log_data.action.upper())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid action: {log_data.action}")
        
        # Get client IP
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get('user-agent')
        
        # Create log entry
        user_log = UserLog(
            user_id=current_user.id if current_user else None,
            log_level=log_level_enum,
            action=action_enum,
            message=log_data.message,
            context=log_data.context,
            url=log_data.url,
            ip_address=client_ip,
            user_agent=user_agent
        )
        
        db.add(user_log)
        db.commit()
        db.refresh(user_log)
        
        logger.info(f"User log received [{log_level_enum.value}] [{action_enum.value}]: {log_data.message[:50]}")
        
        return {"success": True, "message": "Log submitted successfully", "log_id": user_log.id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Submit user log failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit log")

@router.get("/user", response_model=List[UserLogResponse])
async def get_user_logs(
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    username: Optional[str] = Query(None, description="Filter by username (partial match)"),
    log_level: Optional[str] = Query(None, description="Filter by log level"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of logs to return"),
    offset: int = Query(0, ge=0, description="Number of logs to skip"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get user logs with optional filtering (admin only)"""
    try:
        # Start with base query
        query = db.query(UserLog)
        
        # Apply filters
        if user_id:
            query = query.filter(UserLog.user_id == user_id)
        
        if username:
            from models.user import User
            query = query.join(User, UserLog.user_id == User.id, isouter=True).filter(
                User.username.like(f"%{username}%")
            )
        
        if log_level:
            try:
                log_level_enum = UserLogLevel(log_level.upper())
                query = query.filter(UserLog.log_level == log_level_enum)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid log level: {log_level}")
        
        if action:
            try:
                action_enum = UserLogAction(action.upper())
                query = query.filter(UserLog.action == action_enum)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid action: {action}")
        
        # Order by most recent first
        query = query.order_by(UserLog.created_at.desc())
        
        # Apply pagination
        query = query.offset(offset).limit(limit)
        
        # Execute query
        logs = query.all()
        
        return [UserLogResponse.from_log(log) for log in logs]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user logs failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user logs")


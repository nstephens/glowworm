from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from models import get_db
from models.user import User
from utils.middleware import require_auth
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/migration", tags=["migration"])

@router.post("/add-auto-sort-column")
async def add_auto_sort_column(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Add auto_sort column to playlists table"""
    try:
        # Check if column already exists
        result = db.execute(text("""
            SELECT COUNT(*) as count 
            FROM information_schema.columns 
            WHERE table_name = 'playlists' 
            AND column_name = 'auto_sort'
        """))
        
        column_exists = result.fetchone()[0] > 0
        
        if column_exists:
            return {"message": "auto_sort column already exists", "success": True}
        
        # Add the column
        db.execute(text("""
            ALTER TABLE playlists 
            ADD COLUMN auto_sort BOOLEAN DEFAULT FALSE
        """))
        
        # Set default value for existing records
        db.execute(text("""
            UPDATE playlists 
            SET auto_sort = FALSE 
            WHERE auto_sort IS NULL
        """))
        
        db.commit()
        
        return {"message": "Successfully added auto_sort column", "success": True}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to add auto_sort column: {e}")
        raise HTTPException(status_code=500, detail=f"Migration failed: {str(e)}")

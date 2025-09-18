#!/usr/bin/env python3
"""
Script to check existing images and see which ones need hash backfill
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from models.database import SessionLocal
from models import Image
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_existing_images():
    """Check existing images and their hash status"""
    db: Session = SessionLocal()
    try:
        # Get all images
        all_images = db.query(Image).all()
        
        # Count images with and without hashes
        images_with_hashes = db.query(Image).filter(Image.file_hash.isnot(None)).count()
        images_without_hashes = db.query(Image).filter(Image.file_hash.is_(None)).count()
        
        logger.info(f"📊 Image Hash Status Report:")
        logger.info(f"   - Total images: {len(all_images)}")
        logger.info(f"   - Images with hashes: {images_with_hashes}")
        logger.info(f"   - Images without hashes: {images_without_hashes}")
        
        if images_without_hashes > 0:
            logger.info(f"\n📋 Images that need hash backfill:")
            images_needing_hashes = db.query(Image).filter(Image.file_hash.is_(None)).all()
            for i, image in enumerate(images_needing_hashes[:10]):  # Show first 10
                logger.info(f"   {i+1}. ID: {image.id}, Filename: {image.filename}, Original: {image.original_filename}")
            
            if len(images_needing_hashes) > 10:
                logger.info(f"   ... and {len(images_needing_hashes) - 10} more")
            
            logger.info(f"\n💡 To backfill hashes, run: python3 scripts/backfill_image_hashes.py")
        else:
            logger.info(f"\n✅ All images already have hashes!")
        
    except Exception as e:
        logger.error(f"❌ Check failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    check_existing_images()

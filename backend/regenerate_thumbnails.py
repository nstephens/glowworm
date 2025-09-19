#!/usr/bin/env python3
"""
Script to regenerate missing thumbnails for images that don't have them.
This fixes the issue where images with scaled dimensions (_1080x1920) don't have thumbnails.
"""

import sys
import os
from pathlib import Path

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import settings
from models.database import initialize_database, SessionLocal
from models.image import Image
from services.image_storage_service import image_storage_service
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def regenerate_missing_thumbnails():
    """Regenerate thumbnails for images that are missing them"""
    
    # Initialize database
    initialize_database()
    from models.database import SessionLocal
    session = SessionLocal()
    
    try:
        # Get all images from database
        images = session.query(Image).all()
        logger.info(f"Found {len(images)} images in database")
        
        missing_count = 0
        regenerated_count = 0
        
        for image in images:
            logger.info(f"Checking image {image.id}: {image.filename}")
            
            # Check if thumbnails exist for all sizes
            missing_sizes = []
            for size in ['small', 'medium', 'large']:
                thumbnail_path = image_storage_service.get_thumbnail_path(image.filename, size)
                if not thumbnail_path or not thumbnail_path.exists():
                    missing_sizes.append(size)
            
            if missing_sizes:
                missing_count += 1
                logger.warning(f"  Missing thumbnails for sizes: {missing_sizes}")
                
                # Get the original image path
                original_path = image_storage_service.get_image_path(image.filename)
                if original_path and original_path.exists():
                    try:
                        logger.info(f"  Regenerating thumbnails from: {original_path}")
                        
                        # Read the original image file
                        with open(original_path, 'rb') as f:
                            image_content = f.read()
                        
                        # Regenerate thumbnails using the storage service
                        image_storage_service._create_thumbnails(image_content, image.filename)
                        regenerated_count += 1
                        logger.info(f"  ✅ Successfully regenerated thumbnails")
                        
                    except Exception as e:
                        logger.error(f"  ❌ Failed to regenerate thumbnails: {e}")
                else:
                    logger.error(f"  ❌ Original image file not found: {original_path}")
            else:
                logger.info(f"  ✅ All thumbnails exist")
        
        logger.info(f"\n📊 Summary:")
        logger.info(f"  Total images: {len(images)}")
        logger.info(f"  Images missing thumbnails: {missing_count}")
        logger.info(f"  Successfully regenerated: {regenerated_count}")
        logger.info(f"  Failed: {missing_count - regenerated_count}")
        
    except Exception as e:
        logger.error(f"Error during thumbnail regeneration: {e}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    logger.info("🔄 Starting thumbnail regeneration...")
    regenerate_missing_thumbnails()
    logger.info("✅ Thumbnail regeneration complete!")

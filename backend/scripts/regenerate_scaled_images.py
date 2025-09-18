#!/usr/bin/env python3
"""
Script to regenerate scaled images for all existing images in the database.
This is useful when display sizes are configured after images have been uploaded.
"""

import sys
import os
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from models.database import SessionLocal
from models.image import Image
from services.image_storage_service import image_storage_service
from services.config_service import config_service
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def regenerate_scaled_images():
    """Regenerate scaled images for all existing images"""
    
    # Get display sizes
    display_sizes = image_storage_service._load_display_sizes()
    logger.info(f"Display sizes configured: {display_sizes}")
    
    if not display_sizes:
        logger.warning("No display sizes configured. Please configure display sizes in Settings first.")
        return
    
    db = SessionLocal()
    try:
        # Get all images
        images = db.query(Image).all()
        logger.info(f"Found {len(images)} images to process")
        
        processed = 0
        skipped = 0
        errors = 0
        
        for image in images:
            try:
                logger.info(f"Processing image {image.id}: {image.original_filename} ({image.width}x{image.height})")
                
                # Get the original image file
                original_path = image_storage_service.get_image_path(image.filename)
                if not original_path or not original_path.exists():
                    logger.warning(f"Original file not found for image {image.id}: {image.filename}")
                    skipped += 1
                    continue
                
                # Read the original image
                with open(original_path, 'rb') as f:
                    image_bytes = f.read()
                
                # Generate scaled versions for each display size
                for target_width, target_height in display_sizes:
                    try:
                        logger.info(f"  Generating scaled version: {target_width}x{target_height}")
                        
                        # Generate scaled image
                        scaled_bytes = image_storage_service._generate_scaled_image(
                            image_bytes, target_width, target_height
                        )
                        
                        # Save scaled image
                        scaled_filename = f"{Path(image.filename).stem}_{target_width}x{target_height}{Path(image.filename).suffix}"
                        scaled_path = original_path.parent / scaled_filename
                        
                        with open(scaled_path, 'wb') as f:
                            f.write(scaled_bytes)
                        
                        logger.info(f"  ✅ Created: {scaled_filename}")
                        
                    except Exception as e:
                        logger.error(f"  ❌ Failed to generate {target_width}x{target_height}: {e}")
                        errors += 1
                
                processed += 1
                
            except Exception as e:
                logger.error(f"Failed to process image {image.id}: {e}")
                errors += 1
        
        logger.info(f"\n=== Summary ===")
        logger.info(f"Processed: {processed}")
        logger.info(f"Skipped: {skipped}")
        logger.info(f"Errors: {errors}")
        
    finally:
        db.close()

if __name__ == "__main__":
    regenerate_scaled_images()

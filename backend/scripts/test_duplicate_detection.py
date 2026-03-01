#!/usr/bin/env python3
"""
Test script for duplicate image detection functionality
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from models.database import SessionLocal
from services.image_service import ImageService
from services.image_storage_service import image_storage_service
import hashlib
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_duplicate_detection():
    """Test the duplicate detection functionality"""
    db: Session = SessionLocal()
    try:
        image_service = ImageService(db)
        
        # Create a test file content
        test_content = b"This is a test image content for duplicate detection"
        test_hash = hashlib.md5(test_content).hexdigest()
        
        logger.info(f"Test hash: {test_hash}")
        
        # Test 1: Check if hash exists (should be False initially)
        is_duplicate = image_service.check_duplicate_by_hash(test_hash)
        logger.info(f"Test 1 - Hash exists check: {is_duplicate}")
        assert not is_duplicate, "Hash should not exist initially"
        
        # Test 2: Create a mock image record with the hash
        mock_image = image_service.create_image(
            filename="test_image.jpg",
            original_filename="test_image.jpg",
            width=100,
            height=100,
            file_size=len(test_content),
            mime_type="image/jpeg",
            file_hash=test_hash
        )
        logger.info(f"Test 2 - Created mock image with ID: {mock_image.id}")
        
        # Test 3: Check if hash exists now (should be True)
        is_duplicate = image_service.check_duplicate_by_hash(test_hash)
        logger.info(f"Test 3 - Hash exists check after creation: {is_duplicate}")
        assert is_duplicate, "Hash should exist after creation"
        
        # Test 4: Get existing image by hash
        existing_image = image_service.get_image_by_hash(test_hash)
        logger.info(f"Test 4 - Retrieved existing image: {existing_image.id if existing_image else 'None'}")
        assert existing_image is not None, "Should be able to retrieve image by hash"
        assert existing_image.id == mock_image.id, "Retrieved image should match created image"
        
        # Test 5: Test with different hash (should not exist)
        different_hash = hashlib.md5(b"Different content").hexdigest()
        is_duplicate = image_service.check_duplicate_by_hash(different_hash)
        logger.info(f"Test 5 - Different hash exists check: {is_duplicate}")
        assert not is_duplicate, "Different hash should not exist"
        
        # Clean up
        image_service.delete_image(mock_image.id)
        logger.info("Test 6 - Cleaned up test image")
        
        logger.info("✅ All duplicate detection tests passed!")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    test_duplicate_detection()

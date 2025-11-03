"""
Color Extraction Service

Extracts dominant colors from images for use in display modes like Color Harmony.
Uses ColorThief library for efficient color palette generation.
"""

import logging
from typing import List, Optional
from colorthief import ColorThief
from PIL import Image as PILImage
import os

logger = logging.getLogger(__name__)


def rgb_to_hex(rgb: tuple) -> str:
    """Convert RGB tuple to hex color string"""
    r, g, b = rgb
    return f"#{r:02x}{g:02x}{b:02x}"


def extract_dominant_colors(
    image_path: str,
    color_count: int = 3,
    quality: int = 10
) -> Optional[List[str]]:
    """
    Extract dominant colors from an image
    
    Args:
        image_path: Absolute path to the image file
        color_count: Number of colors to extract (default: 3)
        quality: Quality/speed tradeoff (1-10, lower is better quality but slower)
    
    Returns:
        List of hex color strings like ["#FF5733", "#33FF57", "#3357FF"]
        Returns None if extraction fails
    
    Performance:
        - Quality 10: Fast, suitable for background processing
        - Quality 1: Slow, highest accuracy
        - Recommended: 10 for batch processing, 5 for real-time
    """
    try:
        # Verify file exists
        if not os.path.exists(image_path):
            logger.error(f"Image file not found: {image_path}")
            return None
        
        # Verify it's a valid image
        try:
            with PILImage.open(image_path) as img:
                # Convert RGBA to RGB if needed
                if img.mode in ('RGBA', 'LA', 'P'):
                    # Create white background
                    background = PILImage.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    # Save temporarily for ColorThief
                    temp_path = image_path + '.temp.jpg'
                    background.save(temp_path, 'JPEG')
                    image_path = temp_path
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                    temp_path = image_path + '.temp.jpg'
                    img.save(temp_path, 'JPEG')
                    image_path = temp_path
        except Exception as e:
            logger.error(f"Error validating image: {e}")
            return None
        
        # Extract color palette
        color_thief = ColorThief(image_path)
        palette = color_thief.get_palette(color_count=color_count, quality=quality)
        
        # Clean up temp file if created
        if image_path.endswith('.temp.jpg'):
            try:
                os.remove(image_path)
            except:
                pass
        
        # Convert to hex strings
        hex_colors = [rgb_to_hex(color) for color in palette]
        
        logger.info(f"Extracted {len(hex_colors)} colors from {image_path}: {hex_colors}")
        return hex_colors
        
    except Exception as e:
        logger.error(f"Error extracting colors from {image_path}: {e}")
        return None


def extract_dominant_colors_from_bytes(
    image_bytes: bytes,
    color_count: int = 3,
    quality: int = 10
) -> Optional[List[str]]:
    """
    Extract dominant colors from image bytes (for uploaded images)
    
    Args:
        image_bytes: Image data as bytes
        color_count: Number of colors to extract
        quality: Quality/speed tradeoff (1-10)
    
    Returns:
        List of hex color strings or None if extraction fails
    """
    import tempfile
    
    try:
        # Write bytes to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
            tmp_file.write(image_bytes)
            tmp_path = tmp_file.name
        
        # Extract colors
        colors = extract_dominant_colors(tmp_path, color_count, quality)
        
        # Clean up temp file
        try:
            os.remove(tmp_path)
        except:
            pass
        
        return colors
        
    except Exception as e:
        logger.error(f"Error extracting colors from bytes: {e}")
        return None


# Create singleton instance
class ColorExtractorService:
    """Service for extracting dominant colors from images"""
    
    def __init__(self):
        self.default_color_count = 3
        self.default_quality = 10
    
    def extract_colors(
        self,
        image_path: str,
        color_count: Optional[int] = None,
        quality: Optional[int] = None
    ) -> Optional[List[str]]:
        """Extract dominant colors from image file"""
        return extract_dominant_colors(
            image_path,
            color_count or self.default_color_count,
            quality or self.default_quality
        )
    
    def extract_colors_from_bytes(
        self,
        image_bytes: bytes,
        color_count: Optional[int] = None,
        quality: Optional[int] = None
    ) -> Optional[List[str]]:
        """Extract dominant colors from image bytes"""
        return extract_dominant_colors_from_bytes(
            image_bytes,
            color_count or self.default_color_count,
            quality or self.default_quality
        )


# Global service instance
color_extractor_service = ColorExtractorService()


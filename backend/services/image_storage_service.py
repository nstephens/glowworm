import os
import uuid
import hashlib
import json
from pathlib import Path
from typing import Optional, Tuple, Dict, Any, List
from PIL import Image as PILImage
from PIL.ExifTags import TAGS
import io
import logging
from datetime import datetime
from config.settings import settings

logger = logging.getLogger(__name__)

class ImageStorageService:
    """Service for managing image storage with smart hierarchy and processing"""
    
    # Supported image formats
    SUPPORTED_FORMATS = {'JPEG', 'PNG', 'GIF', 'WEBP', 'AVIF', 'MPO'}
    SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.mpo'}
    
    # Thumbnail sizes
    THUMBNAIL_SIZES = {
        'small': (150, 150),
        'medium': (300, 300),
        'large': (600, 600)
    }
    
    def __init__(self):
        self.upload_path = Path(settings.upload_path)
        self.thumbnails_path = self.upload_path / "thumbnails"
        self._ensure_directories()
    
    def _ensure_directories(self):
        """Ensure upload and thumbnail directories exist"""
        self.upload_path.mkdir(parents=True, exist_ok=True)
        self.thumbnails_path.mkdir(parents=True, exist_ok=True)
        
        # Create year/month subdirectories for organization
        current_date = datetime.now()
        year_month_path = self.upload_path / str(current_date.year) / f"{current_date.month:02d}"
        year_month_path.mkdir(parents=True, exist_ok=True)
    
    def _load_display_sizes(self) -> List[Tuple[int, int]]:
        """Load configured display sizes from settings"""
        logger.info("🔍 Loading display sizes from database...")
        try:
            from services.config_service import config_service
            
            display_sizes = config_service.target_display_sizes
            logger.info(f"Raw display sizes from database: {display_sizes}")
            parsed_sizes = []
            
            for size_str in display_sizes:
                try:
                    # Parse size string like "1080x1920", "1920x1080", "2k", "2k-portrait", "4k", "4k-portrait"
                    if 'x' in size_str:
                        # Direct format like "1080x1920" or "2560x1440"
                        width, height = map(int, size_str.split('x'))
                        parsed_sizes.append((width, height))
                        logger.info(f"Parsed size: {size_str} -> ({width}, {height})")
                    elif size_str == "2k" or size_str == "2k-landscape":
                        # 2K landscape resolution (QHD/1440p)
                        parsed_sizes.append((2560, 1440))
                        logger.info(f"Parsed size: {size_str} -> (2560, 1440)")
                    elif size_str == "2k-portrait":
                        # 2K portrait resolution (1080p rotated)
                        parsed_sizes.append((1080, 1920))
                        logger.info(f"Parsed size: {size_str} -> (1080, 1920)")
                    elif size_str == "4k" or size_str == "4k-landscape":
                        # 4K landscape resolution (UHD)
                        parsed_sizes.append((3840, 2160))
                        logger.info(f"Parsed size: {size_str} -> (3840, 2160)")
                    elif size_str == "4k-portrait":
                        # 4K portrait resolution
                        parsed_sizes.append((2160, 3840))
                        logger.info(f"Parsed size: {size_str} -> (2160, 3840)")
                    elif size_str == "1080p" or size_str == "fullhd":
                        # Full HD landscape
                        parsed_sizes.append((1920, 1080))
                        logger.info(f"Parsed size: {size_str} -> (1920, 1080)")
                    else:
                        logger.warning(f"Unknown display size format: {size_str}")
                        continue
                except ValueError:
                    logger.warning(f"Invalid display size format: {size_str}")
                    continue
            
            logger.info(f"✅ Final display sizes: {parsed_sizes}")
            return parsed_sizes
        except Exception as e:
            logger.error(f"❌ Failed to load display sizes: {e}")
            return []
    
    def _generate_unique_filename(self, original_filename: str) -> str:
        """Generate a unique filename using UUID and preserve extension"""
        # Get file extension
        ext = Path(original_filename).suffix.lower()
        if ext not in self.SUPPORTED_EXTENSIONS:
            raise ValueError(f"Unsupported file extension: {ext}")
        
        # Generate unique filename
        unique_id = uuid.uuid4().hex
        return f"{unique_id}{ext}"
    
    def _get_storage_path(self, filename: str, user_id: Optional[int] = None) -> Path:
        """Get the storage path for a file using smart hierarchy"""
        current_date = datetime.now()
        
        # Organize by year/month/user for efficient management
        if user_id:
            storage_path = self.upload_path / str(current_date.year) / f"{current_date.month:02d}" / f"user_{user_id}"
        else:
            storage_path = self.upload_path / str(current_date.year) / f"{current_date.month:02d}"
        
        storage_path.mkdir(parents=True, exist_ok=True)
        return storage_path / filename
    
    def _get_thumbnail_path(self, filename: str, size: str = 'medium') -> Path:
        """Get the thumbnail path for a file"""
        name, ext = filename.rsplit('.', 1)
        thumbnail_filename = f"{name}_{size}_thumb.{ext}"
        return self.thumbnails_path / thumbnail_filename
    
    def _extract_exif_data(self, image: PILImage.Image) -> Dict[str, Any]:
        """Extract EXIF data from image with proper serialization handling"""
        exif_data = {}
        
        if hasattr(image, '_getexif'):
            exif = image._getexif()
            if exif is not None:
                for tag_id, value in exif.items():
                    tag = TAGS.get(tag_id, tag_id)
                    # Convert non-serializable types to strings or numbers
                    exif_data[tag] = self._serialize_exif_value(value)
        
        return exif_data
    
    def _calculate_file_hash(self, file_bytes: bytes) -> str:
        """Calculate MD5 hash of file bytes"""
        return hashlib.md5(file_bytes).hexdigest()
    
    def _serialize_exif_value(self, value):
        """Convert EXIF values to JSON-serializable types"""
        if value is None:
            return None
        elif isinstance(value, (str, int, float, bool)):
            return value
        elif isinstance(value, bytes):
            # Convert bytes to string representation
            try:
                return value.decode('utf-8', errors='ignore')
            except:
                return str(value)
        elif hasattr(value, 'numerator') and hasattr(value, 'denominator'):
            # Handle IFDRational and similar rational types
            try:
                return float(value.numerator) / float(value.denominator)
            except (ZeroDivisionError, AttributeError):
                return str(value)
        elif isinstance(value, (list, tuple)):
            # Recursively handle lists and tuples
            return [self._serialize_exif_value(item) for item in value]
        elif isinstance(value, dict):
            # Recursively handle dictionaries
            return {str(k): self._serialize_exif_value(v) for k, v in value.items()}
        else:
            # For any other type, convert to string
            return str(value)
    
    def _apply_exif_orientation(self, img: PILImage.Image) -> PILImage.Image:
        """Apply EXIF orientation to correct image rotation for mobile photos"""
        if img is None:
            logger.warning("Cannot apply EXIF orientation: image is None")
            return img
            
        try:
            # Check if image has EXIF data
            exif = None
            if hasattr(img, '_getexif'):
                exif = img._getexif()
            elif hasattr(img, 'getexif'):
                # Pillow 8.0+ uses getexif()
                try:
                    exif_dict = img.getexif()
                    if exif_dict:
                        # Convert to dict for compatibility
                        exif = {tag: value for tag, value in exif_dict.items()}
                except Exception:
                    pass
            
            if exif is not None:
                # EXIF orientation tag (0x0112 or 274)
                orientation = exif.get(274) or exif.get(0x0112)
                
                if orientation and orientation != 1:  # 1 is normal, no rotation needed
                    try:
                        if orientation == 2:
                            # Mirror horizontal
                            img = img.transpose(PILImage.FLIP_LEFT_RIGHT)
                        elif orientation == 3:
                            # Rotate 180 degrees
                            img = img.rotate(180, expand=True)
                        elif orientation == 4:
                            # Mirror vertical
                            img = img.transpose(PILImage.FLIP_TOP_BOTTOM)
                        elif orientation == 5:
                            # Mirror horizontal + rotate 90 degrees counter-clockwise
                            img = img.transpose(PILImage.FLIP_LEFT_RIGHT).rotate(90, expand=True)
                        elif orientation == 6:
                            # Rotate 90 degrees clockwise
                            img = img.rotate(-90, expand=True)
                        elif orientation == 7:
                            # Mirror horizontal + rotate 90 degrees clockwise
                            img = img.transpose(PILImage.FLIP_LEFT_RIGHT).rotate(-90, expand=True)
                        elif orientation == 8:
                            # Rotate 90 degrees counter-clockwise
                            img = img.rotate(90, expand=True)
                        
                        logger.debug(f"Applied EXIF orientation {orientation} to image")
                    except Exception as rotate_error:
                        logger.warning(f"Failed to apply rotation for orientation {orientation}: {rotate_error}")
                        # Return image unchanged if rotation fails
                        return img
        except Exception as e:
            logger.warning(f"Failed to apply EXIF orientation: {e}")
        
        return img
    
    def _generate_thumbnail(self, image_bytes: bytes, size: str = 'medium') -> bytes:
        """Generate thumbnail from image bytes with EXIF orientation handling"""
        try:
            with PILImage.open(io.BytesIO(image_bytes)) as img:
                # Handle EXIF orientation for mobile photos
                img = self._apply_exif_orientation(img)
                
                # Convert to RGB if necessary (for JPEG compatibility)
                if img.mode in ('RGBA', 'LA', 'P'):
                    img = img.convert('RGB')
                
                # Generate thumbnail
                thumbnail_size = self.THUMBNAIL_SIZES[size]
                img.thumbnail(thumbnail_size, PILImage.Resampling.LANCZOS)
                
                # Save to bytes
                output = io.BytesIO()
                img.save(output, format='JPEG', quality=85, optimize=True)
                return output.getvalue()
        except Exception as e:
            logger.error(f"Failed to generate thumbnail: {e}")
            raise
    
    def _generate_scaled_image(self, image_bytes: bytes, target_width: int, target_height: int) -> bytes:
        """Generate a scaled version of the image optimized for target dimensions with movement support"""
        try:
            with PILImage.open(io.BytesIO(image_bytes)) as img:
                # Handle EXIF orientation for mobile photos
                img = self._apply_exif_orientation(img)
                
                # Convert to RGB if necessary
                if img.mode in ('RGBA', 'LA', 'P'):
                    img = img.convert('RGB')
                
                original_width, original_height = img.size
                original_ratio = original_width / original_height
                target_ratio = target_width / target_height
                
                # Determine image orientation
                is_original_portrait = original_height > original_width
                is_target_portrait = target_height > target_width
                
                logger.info(f"Original: {original_width}x{original_height} ({'portrait' if is_original_portrait else 'landscape'}), "
                           f"Target: {target_width}x{target_height} ({'portrait' if is_target_portrait else 'landscape'})")
                
                # Smart scaling with movement support
                if is_original_portrait and is_target_portrait:
                    # Both portrait - scale to fit height, allow some width cropping if needed
                    scale = target_height / original_height
                    new_width = int(original_width * scale)
                    new_height = target_height
                    
                    if new_width > target_width:
                        # Image is too wide, scale down to fit width instead
                        scale = target_width / original_width
                        new_width = target_width
                        new_height = int(original_height * scale)
                    
                elif not is_original_portrait and not is_target_portrait:
                    # Both landscape - scale to fit width, allow some height cropping if needed
                    scale = target_width / original_width
                    new_width = target_width
                    new_height = int(original_height * scale)
                    
                    if new_height > target_height:
                        # Image is too tall, scale down to fit height instead
                        scale = target_height / original_height
                        new_width = int(original_width * scale)
                        new_height = target_height
                
                else:
                    # Orientation mismatch - prioritize movement effect for landscape images
                    if is_original_portrait and not is_target_portrait:
                        # Portrait image for landscape target - scale to fit height
                        scale = target_height / original_height
                        new_width = int(original_width * scale)
                        new_height = target_height
                    else:
                        # Landscape image for portrait target - scale to enable movement effect
                        # Scale to fit height first, then ensure width is wide enough for movement
                        scale = target_height / original_height
                        new_width = int(original_width * scale)
                        new_height = target_height
                        
                        # For landscape images on portrait displays, ensure width is larger than target
                        # to enable the movement effect (5% pan in each direction = 10% extra width needed)
                        min_width_for_movement = int(target_width * 1.15)  # 15% extra for movement
                        if new_width < min_width_for_movement:
                            # Scale up width while keeping height at target
                            scale = min_width_for_movement / original_width
                            new_width = min_width_for_movement
                            new_height = target_height  # Keep height constrained to target
                
                # Resize image
                resized_img = img.resize((new_width, new_height), PILImage.Resampling.LANCZOS)
                
                # Create final image
                if new_width == target_width and new_height == target_height:
                    # Perfect fit
                    final_img = resized_img
                elif new_width > target_width or new_height > target_height:
                    # Image is larger than target (good for movement) - use as-is
                    final_img = resized_img
                else:
                    # Image is smaller than target - create background and center the image
                    final_img = PILImage.new('RGB', (target_width, target_height), (255, 255, 255))
                    
                    # Calculate position to center the image
                    x_offset = (target_width - new_width) // 2
                    y_offset = (target_height - new_height) // 2
                    
                    # Paste the resized image onto the background
                    final_img.paste(resized_img, (x_offset, y_offset))
                
                logger.info(f"Scaled to: {new_width}x{new_height}, final: {target_width}x{target_height}")
                
                # Save to bytes
                output = io.BytesIO()
                final_img.save(output, format='JPEG', quality=90, optimize=True)
                return output.getvalue()
        except Exception as e:
            logger.error(f"Failed to generate scaled image {target_width}x{target_height}: {e}")
            raise
    
    def validate_image(self, file_bytes: bytes, filename: str) -> Tuple[bool, str]:
        """Validate image file"""
        try:
            # Check file extension
            ext = Path(filename).suffix.lower()
            if ext not in self.SUPPORTED_EXTENSIONS:
                return False, f"Unsupported file extension: {ext}"
            
            # Check file size
            if len(file_bytes) > settings.max_file_size:
                return False, f"File too large. Maximum size: {settings.max_file_size} bytes"
            
            # Validate image content
            with PILImage.open(io.BytesIO(file_bytes)) as img:
                # Check format (case insensitive)
                if img.format and img.format.upper() not in {f.upper() for f in self.SUPPORTED_FORMATS}:
                    return False, f"Unsupported image format: {img.format}"
                
                # Basic validation - try to load the image
                try:
                    # Try to access basic properties to ensure image is readable
                    _ = img.size
                    _ = img.mode
                except Exception as e:
                    return False, f"Corrupted or invalid image: {str(e)}"
            
            return True, "Valid image"
            
        except Exception as e:
            return False, f"Invalid image: {str(e)}"
    
    def process_and_store_image(
        self, 
        file_bytes: bytes, 
        original_filename: str,
        user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Process and store image with metadata extraction and thumbnail generation"""
        
        # Validate image
        is_valid, message = self.validate_image(file_bytes, original_filename)
        if not is_valid:
            raise ValueError(message)
        
        # Calculate file hash for duplicate detection
        file_hash = self._calculate_file_hash(file_bytes)
        
        # Generate unique filename
        filename = self._generate_unique_filename(original_filename)
        
        # Get storage paths
        storage_path = self._get_storage_path(filename, user_id)
        
        # Process image
        original_file_bytes = file_bytes  # Keep original for fallback
        processed_image = None
        
        try:
            with PILImage.open(io.BytesIO(file_bytes)) as img:
                # Extract EXIF data BEFORE applying orientation (need original orientation tag)
                exif_data = self._extract_exif_data(img)
                
                # Apply EXIF orientation correction for mobile photos
                # Make a copy to avoid modifying the original image object in the context manager
                try:
                    # Copy the image so we can process it outside the context manager
                    processed_image = img.copy()
                except Exception as e:
                    logger.warning(f"Failed to copy image, processing in-place: {e}")
                    processed_image = img
                
                # Apply orientation to the copy
                processed_image = self._apply_exif_orientation(processed_image)
                
                # Get image metadata AFTER orientation correction
                width, height = processed_image.size
                format_name = processed_image.format
                mode = processed_image.mode
        except Exception as e:
            logger.error(f"Failed to open/process image: {e}")
            # Fallback: process without EXIF orientation
            logger.info("Falling back to processing without EXIF orientation")
            with PILImage.open(io.BytesIO(original_file_bytes)) as img:
                exif_data = self._extract_exif_data(img)
                processed_image = img.copy()
                width, height = processed_image.size
                format_name = processed_image.format
                mode = processed_image.mode
        
        # Now process the image object (outside the context manager)
        try:
            img = processed_image
            
            # Normalize MPO to JPEG for broad client compatibility (serve first frame)
            if format_name and format_name.upper() == 'MPO':
                try:
                    img.seek(0)  # ensure first frame
                except Exception:
                    pass
                if img.mode in ('RGBA', 'LA', 'P'):
                    img = img.convert('RGB')
                format_name = 'JPEG'
                # Ensure stored filename uses .jpg extension
                try:
                    filename = Path(filename).with_suffix('.jpg').name
                    storage_path = self._get_storage_path(filename, user_id)
                except Exception:
                    # Fallback keeps existing filename if path manipulation fails
                    pass
                mode = 'RGB' if img.mode != 'RGB' else img.mode
            
            # Convert to RGB for consistent storage
            if img.mode in ('RGBA', 'LA', 'P'):
                try:
                    img = img.convert('RGB')
                    format_name = 'JPEG'
                except Exception as e:
                    logger.warning(f"Failed to convert image to RGB: {e}, keeping original mode")
            
            # Save corrected image with orientation applied and EXIF orientation tag removed
            # This prevents browsers from double-rotating the image
            output = io.BytesIO()
            
            # Save image without EXIF to prevent double-rotation
            # Since we've already physically rotated the image based on EXIF orientation,
            # we save without EXIF to prevent browsers from applying rotation again
            # The EXIF metadata is already extracted and stored in database, so we don't lose information
            save_kwargs = {'format': format_name, 'optimize': True}
            if format_name == 'JPEG':
                save_kwargs['quality'] = 90
                # Don't pass exif parameter - this saves without EXIF data
                # This prevents browsers from double-rotating the already-corrected image
            
            try:
                img.save(output, **save_kwargs)
                file_bytes = output.getvalue()
            except Exception as e:
                logger.error(f"Failed to save processed image: {e}")
                # Fallback to original image if save fails
                logger.info("Falling back to original image bytes")
                file_bytes = original_file_bytes
                # Re-extract metadata from original
                with PILImage.open(io.BytesIO(original_file_bytes)) as fallback_img:
                    width, height = fallback_img.size
                    format_name = fallback_img.format or 'JPEG'
                    mode = fallback_img.mode
        except Exception as e:
            logger.error(f"Failed to process image after EXIF orientation: {e}")
            # Complete fallback: use original image
            logger.info("Falling back to original image bytes completely")
            file_bytes = original_file_bytes
            with PILImage.open(io.BytesIO(original_file_bytes)) as fallback_img:
                width, height = fallback_img.size
                format_name = fallback_img.format or 'JPEG'
                mode = fallback_img.mode
        
        # Save corrected image
        with open(storage_path, 'wb') as f:
            f.write(file_bytes)
        
        # Generate thumbnails
        thumbnail_paths = {}
        for size_name in self.THUMBNAIL_SIZES.keys():
            try:
                thumbnail_bytes = self._generate_thumbnail(file_bytes, size_name)
                thumbnail_path = self._get_thumbnail_path(filename, size_name)
                
                with open(thumbnail_path, 'wb') as f:
                    f.write(thumbnail_bytes)
                
                thumbnail_paths[size_name] = str(thumbnail_path)
            except Exception as e:
                logger.warning(f"Failed to generate {size_name} thumbnail: {e}")
        
        # Generate scaled versions for display sizes
        scaled_paths = {}
        logger.info("🖼️ Starting scaled image generation...")
        display_sizes = self._load_display_sizes()
        logger.info(f"Display sizes to process: {display_sizes}")
        
        for target_width, target_height in display_sizes:
            try:
                logger.info(f"Generating scaled image: {target_width}x{target_height}")
                scaled_bytes = self._generate_scaled_image(file_bytes, target_width, target_height)
                scaled_filename = f"{Path(filename).stem}_{target_width}x{target_height}{Path(filename).suffix}"
                scaled_path = self._get_storage_path(scaled_filename, user_id)
                
                logger.info(f"Saving scaled image to: {scaled_path}")
                with open(scaled_path, 'wb') as f:
                    f.write(scaled_bytes)
                
                scaled_paths[f"{target_width}x{target_height}"] = str(scaled_path)
                logger.info(f"✅ Successfully created scaled image: {scaled_filename}")
            except Exception as e:
                logger.error(f"❌ Failed to generate scaled image {target_width}x{target_height}: {e}")
        
        # Return metadata
        return {
            'filename': filename,
            'original_filename': original_filename,
            'storage_path': str(storage_path),
            'thumbnail_paths': thumbnail_paths,
            'scaled_paths': scaled_paths,
            'width': width,
            'height': height,
            'file_size': len(file_bytes),
            'mime_type': f"image/{format_name.lower()}",
            'file_hash': file_hash,
            'exif': exif_data,
            'format': format_name,
            'mode': mode
        }
    
    def delete_image(self, filename: str) -> bool:
        """Delete image and its thumbnails"""
        try:
            # Find and delete original file
            for year_dir in self.upload_path.iterdir():
                if year_dir.is_dir():
                    for month_dir in year_dir.iterdir():
                        if month_dir.is_dir():
                            for user_dir in month_dir.iterdir():
                                if user_dir.is_dir():
                                    image_path = user_dir / filename
                                    if image_path.exists():
                                        image_path.unlink()
                                        break
                            else:
                                image_path = month_dir / filename
                                if image_path.exists():
                                    image_path.unlink()
                                    break
            
            # Delete thumbnails
            for size_name in self.THUMBNAIL_SIZES.keys():
                thumbnail_path = self._get_thumbnail_path(filename, size_name)
                if thumbnail_path.exists():
                    thumbnail_path.unlink()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete image {filename}: {e}")
            return False
    
    def get_image_path(self, filename: str) -> Optional[Path]:
        """Get the full path to an image file"""
        for year_dir in self.upload_path.iterdir():
            if year_dir.is_dir():
                for month_dir in year_dir.iterdir():
                    if month_dir.is_dir():
                        for user_dir in month_dir.iterdir():
                            if user_dir.is_dir():
                                image_path = user_dir / filename
                                if image_path.exists():
                                    return image_path
                        else:
                            image_path = month_dir / filename
                            if image_path.exists():
                                return image_path
        return None
    
    def get_thumbnail_path(self, filename: str, size: str = 'medium') -> Optional[Path]:
        """Get the full path to a thumbnail"""
        thumbnail_path = self._get_thumbnail_path(filename, size)
        return thumbnail_path if thumbnail_path.exists() else None
    
    def get_available_resolutions(self, filename: str) -> List[Dict[str, Any]]:
        """Get available resolution variants for an image"""
        try:
            from pathlib import Path
            
            # Get the base filename without extension
            base_name = Path(filename).stem
            extension = Path(filename).suffix
            
            # Get configured display sizes
            display_sizes = self._load_display_sizes()
            available_variants = []
            
            for width, height in display_sizes:
                # Check if scaled version exists
                scaled_filename = f"{base_name}_{width}x{height}{extension}"
                scaled_path = self.upload_path / "scaled" / scaled_filename
                
                if scaled_path.exists():
                    # Get file size
                    file_size = scaled_path.stat().st_size
                    
                    available_variants.append({
                        "dimensions": f"{width}x{height}",
                        "width": width,
                        "height": height,
                        "filename": scaled_filename,
                        "url": f"/api/images/scaled/{scaled_filename}",
                        "file_size": file_size,
                        "file_size_mb": round(file_size / (1024 * 1024), 2)
                    })
            
            return available_variants
            
        except Exception as e:
            logger.error(f"Error getting available resolutions for {filename}: {e}")
            return []

# Global instance
image_storage_service = ImageStorageService()

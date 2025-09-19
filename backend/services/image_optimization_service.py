import os
import io
import hashlib
from pathlib import Path
from typing import Optional, Tuple, Dict, Any, List
from PIL import Image as PILImage
import logging
from datetime import datetime, timedelta
from config.settings import settings
import asyncio
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

class ImageOptimizationService:
    """Service for optimizing image delivery in home network environment"""
    
    # Supported output formats for optimization
    SUPPORTED_OUTPUT_FORMATS = {
        'webp': 'image/webp',
        'avif': 'image/avif',
        'jpeg': 'image/jpeg',
        'png': 'image/png'
    }
    
    # Quality settings for different formats
    QUALITY_SETTINGS = {
        'webp': {'quality': 85, 'method': 6},
        'avif': {'quality': 80, 'speed': 4},
        'jpeg': {'quality': 85, 'optimize': True},
        'png': {'optimize': True}
    }
    
    # Cache settings for home network
    CACHE_SETTINGS = {
        'original': {
            'max_age': 31536000,  # 1 year
            'immutable': True
        },
        'optimized': {
            'max_age': 2592000,   # 30 days
            'immutable': False
        },
        'thumbnail': {
            'max_age': 2592000,   # 30 days
            'immutable': False
        }
    }
    
    def __init__(self):
        self.upload_path = Path(settings.upload_path)
        self.optimized_path = self.upload_path / "optimized"
        self.preload_cache = {}  # In-memory cache for preloaded images
        self.executor = ThreadPoolExecutor(max_workers=4)
        self._ensure_directories()
    
    def _ensure_directories(self):
        """Ensure optimization directories exist"""
        self.optimized_path.mkdir(parents=True, exist_ok=True)
        
        # Create format-specific subdirectories
        for format_name in self.SUPPORTED_OUTPUT_FORMATS.keys():
            format_path = self.optimized_path / format_name
            format_path.mkdir(parents=True, exist_ok=True)
    
    def _get_optimized_path(self, filename: str, format: str, width: Optional[int] = None, height: Optional[int] = None, quality: int = 85) -> Path:
        """Get path for optimized image"""
        name, ext = filename.rsplit('.', 1)
        
        # Create cache key for dimensions and quality
        cache_key = f"{name}_{format}_{width or 'auto'}x{height or 'auto'}_q{quality}"
        optimized_filename = f"{cache_key}.{format}"
        
        return self.optimized_path / format / optimized_filename
    
    def _detect_best_format(self, accept_header: str, original_format: str) -> str:
        """Detect the best format based on Accept header and original format"""
        if not accept_header:
            return original_format.lower()
        
        accept_header = accept_header.lower()
        
        # Check for AVIF support (best compression)
        if 'avif' in accept_header and original_format.lower() in ['jpeg', 'png']:
            return 'avif'
        
        # Check for WebP support (good compression, wide support)
        if 'webp' in accept_header and original_format.lower() in ['jpeg', 'png']:
            return 'webp'
        
        # Fall back to original format
        return original_format.lower()
    
    def _optimize_image(
        self, 
        image_bytes: bytes, 
        output_format: str, 
        width: Optional[int] = None, 
        height: Optional[int] = None, 
        quality: int = 85
    ) -> bytes:
        """Optimize image with format conversion and resizing"""
        try:
            with PILImage.open(io.BytesIO(image_bytes)) as img:
                # Convert to RGB if necessary
                if img.mode in ('RGBA', 'LA', 'P'):
                    if output_format in ['jpeg', 'webp']:
                        # Create white background for JPEG/WebP
                        background = PILImage.new('RGB', img.size, (255, 255, 255))
                        if img.mode == 'P':
                            img = img.convert('RGBA')
                        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                        img = background
                    else:
                        img = img.convert('RGBA')
                
                # Resize if dimensions specified
                if width or height:
                    # Calculate new dimensions maintaining aspect ratio
                    original_width, original_height = img.size
                    
                    if width and height:
                        # Both dimensions specified - crop to fit
                        img.thumbnail((width, height), PILImage.Resampling.LANCZOS)
                    elif width:
                        # Width specified - maintain aspect ratio
                        ratio = width / original_width
                        height = int(original_height * ratio)
                        img = img.resize((width, height), PILImage.Resampling.LANCZOS)
                    elif height:
                        # Height specified - maintain aspect ratio
                        ratio = height / original_height
                        width = int(original_width * ratio)
                        img = img.resize((width, height), PILImage.Resampling.LANCZOS)
                
                # Save in optimized format
                output = io.BytesIO()
                save_kwargs = self.QUALITY_SETTINGS.get(output_format, {})
                
                if output_format == 'webp':
                    img.save(output, format='WEBP', **save_kwargs)
                elif output_format == 'avif':
                    # AVIF support requires pillow-avif-plugin
                    try:
                        img.save(output, format='AVIF', **save_kwargs)
                    except Exception:
                        # Fall back to WebP if AVIF not supported
                        img.save(output, format='WEBP', **self.QUALITY_SETTINGS['webp'])
                elif output_format == 'jpeg':
                    img.save(output, format='JPEG', **save_kwargs)
                elif output_format == 'png':
                    img.save(output, format='PNG', **save_kwargs)
                else:
                    # Fall back to original format
                    img.save(output, format=img.format)
                
                return output.getvalue()
                
        except Exception as e:
            logger.error(f"Failed to optimize image: {e}")
            raise
    
    def _generate_cache_headers(self, cache_type: str, filename: str, uploaded_at: datetime, etag_suffix: str = "") -> Dict[str, str]:
        """Generate optimized cache headers for home network"""
        cache_config = self.CACHE_SETTINGS[cache_type]
        
        headers = {
            "Cache-Control": f"public, max-age={cache_config['max_age']}"
        }
        
        if cache_config['immutable']:
            headers["Cache-Control"] += ", immutable"
        
        # Set expiration
        expires = datetime.utcnow() + timedelta(seconds=cache_config['max_age'])
        headers["Expires"] = expires.strftime("%a, %d %b %Y %H:%M:%S GMT")
        
        # Generate ETag
        etag = f'"{filename}_{etag_suffix}_{uploaded_at.timestamp()}"'
        headers["ETag"] = etag
        
        # Set Last-Modified
        headers["Last-Modified"] = uploaded_at.strftime("%a, %d %b %Y %H:%M:%S GMT")
        
        # Add home network specific headers
        headers["X-Content-Type-Options"] = "nosniff"
        headers["X-Frame-Options"] = "SAMEORIGIN"
        
        return headers
    
    async def get_optimized_image(
        self, 
        image_bytes: bytes, 
        filename: str, 
        uploaded_at: datetime,
        accept_header: str = "",
        width: Optional[int] = None, 
        height: Optional[int] = None, 
        quality: int = 85,
        original_format: str = "jpeg"
    ) -> Tuple[bytes, str, Dict[str, str]]:
        """Get optimized image with format detection and caching"""
        
        # Detect best format
        output_format = self._detect_best_format(accept_header, original_format)
        
        # Check if optimized version exists
        optimized_path = self._get_optimized_path(filename, output_format, width, height, quality)
        
        if optimized_path.exists():
            # Serve cached optimized version
            with open(optimized_path, 'rb') as f:
                optimized_bytes = f.read()
            
            cache_headers = self._generate_cache_headers(
                'optimized', 
                filename, 
                uploaded_at, 
                f"{output_format}_{width or 'auto'}x{height or 'auto'}_q{quality}"
            )
            
            return optimized_bytes, self.SUPPORTED_OUTPUT_FORMATS[output_format], cache_headers
        
        # Generate optimized version
        loop = asyncio.get_event_loop()
        optimized_bytes = await loop.run_in_executor(
            self.executor,
            self._optimize_image,
            image_bytes,
            output_format,
            width,
            height,
            quality
        )
        
        # Cache the optimized version
        try:
            with open(optimized_path, 'wb') as f:
                f.write(optimized_bytes)
        except Exception as e:
            logger.warning(f"Failed to cache optimized image: {e}")
        
        cache_headers = self._generate_cache_headers(
            'optimized', 
            filename, 
            uploaded_at, 
            f"{output_format}_{width or 'auto'}x{height or 'auto'}_q{quality}"
        )
        
        return optimized_bytes, self.SUPPORTED_OUTPUT_FORMATS[output_format], cache_headers
    
    def preload_images(self, image_paths: List[str], formats: List[str] = ['webp', 'avif']) -> Dict[str, bool]:
        """Preload images for slideshow performance"""
        preload_results = {}
        
        for image_path in image_paths:
            try:
                path = Path(image_path)
                if not path.exists():
                    preload_results[image_path] = False
                    continue
                
                # Read image
                with open(path, 'rb') as f:
                    image_bytes = f.read()
                
                # Generate optimized versions
                for format_name in formats:
                    try:
                        optimized_bytes = self._optimize_image(image_bytes, format_name)
                        
                        # Store in memory cache
                        cache_key = f"{path.name}_{format_name}"
                        self.preload_cache[cache_key] = {
                            'bytes': optimized_bytes,
                            'format': self.SUPPORTED_OUTPUT_FORMATS[format_name],
                            'cached_at': datetime.utcnow()
                        }
                        
                    except Exception as e:
                        logger.warning(f"Failed to preload {image_path} as {format_name}: {e}")
                
                preload_results[image_path] = True
                
            except Exception as e:
                logger.error(f"Failed to preload {image_path}: {e}")
                preload_results[image_path] = False
        
        return preload_results
    
    def get_preloaded_image(self, filename: str, format: str) -> Optional[Tuple[bytes, str]]:
        """Get preloaded image from cache"""
        cache_key = f"{filename}_{format}"
        cached_data = self.preload_cache.get(cache_key)
        
        if cached_data:
            # Check if cache is still valid (1 hour TTL)
            if (datetime.utcnow() - cached_data['cached_at']).seconds < 3600:
                return cached_data['bytes'], cached_data['format']
            else:
                # Remove expired cache entry
                del self.preload_cache[cache_key]
        
        return None
    
    def clear_preload_cache(self):
        """Clear preload cache"""
        self.preload_cache.clear()
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        return {
            'preload_cache_size': len(self.preload_cache),
            'preload_cache_memory_mb': sum(
                len(data['bytes']) for data in self.preload_cache.values()
            ) / (1024 * 1024),
            'optimized_files_count': sum(
                len(list((self.optimized_path / format).glob('*')))
                for format in self.SUPPORTED_OUTPUT_FORMATS.keys()
            ),
            'cache_directories': {
                format: str(self.optimized_path / format)
                for format in self.SUPPORTED_OUTPUT_FORMATS.keys()
            }
        }

# Global instance
image_optimization_service = ImageOptimizationService()






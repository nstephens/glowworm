"""
Resolution matching service for smart image serving
"""
import logging
from typing import List, Tuple, Optional, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)

class ResolutionMatchingService:
    """Service for finding the best matching resolution for display devices"""
    
    def __init__(self):
        self.logger = logger
    
    def find_best_matching_resolution(
        self, 
        display_width: int, 
        display_height: int, 
        device_pixel_ratio: float = 1.0,
        available_resolutions: List[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Find the best matching resolution for a display device
        
        Args:
            display_width: Display width in pixels
            display_height: Display height in pixels  
            device_pixel_ratio: Device pixel ratio (e.g., 2.0 for Retina displays)
            available_resolutions: List of available resolution variants
            
        Returns:
            Best matching resolution variant or None if no match found
        """
        if not available_resolutions:
            self.logger.warning("No available resolutions provided")
            return None
        
        # Calculate effective display resolution (accounting for pixel ratio)
        effective_width = int(display_width * device_pixel_ratio)
        effective_height = int(display_height * device_pixel_ratio)
        
        self.logger.info(f"🔍 Finding best resolution for display: {display_width}x{display_height} (effective: {effective_width}x{effective_height}, DPR: {device_pixel_ratio})")
        
        # Calculate display aspect ratio
        display_aspect_ratio = effective_width / effective_height
        
        best_match = None
        best_score = float('inf')
        
        # Check if display is larger than all available resolutions
        max_available_width = max(res.get('width', 0) for res in available_resolutions)
        max_available_height = max(res.get('height', 0) for res in available_resolutions)
        
        if effective_width > max_available_width or effective_height > max_available_height:
            self.logger.info(f"📱 Display resolution ({effective_width}x{effective_height}) is larger than all available resolutions (max: {max_available_width}x{max_available_height}). Will use original image.")
            return None  # This will trigger the original image to be used
        
        for resolution in available_resolutions:
            try:
                # Parse resolution dimensions
                width = resolution.get('width', 0)
                height = resolution.get('height', 0)
                
                if width <= 0 or height <= 0:
                    continue
                
                # Calculate resolution aspect ratio
                resolution_aspect_ratio = width / height
                
                # Calculate aspect ratio difference (lower is better)
                aspect_ratio_diff = abs(display_aspect_ratio - resolution_aspect_ratio)
                
                # Calculate size difference (lower is better)
                # We prefer resolutions that are close to or slightly larger than the display
                size_diff = abs(width - effective_width) + abs(height - effective_height)
                
                # Calculate total score (lower is better)
                # Weight aspect ratio more heavily than size difference
                score = (aspect_ratio_diff * 1000) + size_diff
                
                self.logger.debug(f"  📐 Resolution {width}x{height}: aspect_diff={aspect_ratio_diff:.3f}, size_diff={size_diff}, score={score:.1f}")
                
                if score < best_score:
                    best_score = score
                    best_match = resolution
                    
            except Exception as e:
                self.logger.warning(f"Error processing resolution {resolution}: {e}")
                continue
        
        if best_match:
            self.logger.info(f"✅ Best match: {best_match.get('width')}x{best_match.get('height')} (score: {best_score:.1f})")
        else:
            self.logger.warning("❌ No suitable resolution found")
            
        return best_match
    
    def get_display_resolution_info(self, device_info: Dict[str, Any]) -> Tuple[int, int, float]:
        """
        Extract resolution information from device info
        
        Args:
            device_info: Device information dictionary
            
        Returns:
            Tuple of (width, height, pixel_ratio)
        """
        width = device_info.get('screen_width', 1920)  # Default to 1080p
        height = device_info.get('screen_height', 1080)
        pixel_ratio = float(device_info.get('device_pixel_ratio', '1.0'))
        
        return width, height, pixel_ratio
    
    def should_use_original_image(
        self, 
        display_width: int, 
        display_height: int, 
        original_width: int, 
        original_height: int,
        device_pixel_ratio: float = 1.0
    ) -> bool:
        """
        Determine if the original image should be used instead of a scaled version
        
        Args:
            display_width: Display width in pixels
            display_height: Display height in pixels
            original_width: Original image width
            original_height: Original image height
            device_pixel_ratio: Device pixel ratio
            
        Returns:
            True if original image should be used, False otherwise
        """
        effective_width = int(display_width * device_pixel_ratio)
        effective_height = int(display_height * device_pixel_ratio)
        
        # Use original if it's smaller than or close to the effective display size
        # (within 10% tolerance)
        width_ratio = original_width / effective_width
        height_ratio = original_height / effective_height
        
        # If original is smaller than display, use it (browser will scale up natively)
        if width_ratio <= 1.0 and height_ratio <= 1.0:
            self.logger.info(f"📱 Using original image (smaller than display): {original_width}x{original_height} vs {effective_width}x{effective_height}")
            return True
            
        # If original is only slightly larger (within 10%), use it
        if width_ratio <= 1.1 and height_ratio <= 1.1:
            self.logger.info(f"📱 Using original image (close to display size): {original_width}x{original_height} vs {effective_width}x{effective_height}")
            return True
            
        return False

# Global instance
resolution_matching_service = ResolutionMatchingService()

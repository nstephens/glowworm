"""
Image Classification and Pairing Service

Provides utilities for classifying images by orientation and computing
optimal pairing sequences based on display orientation.
"""

from typing import List, Dict, Literal, TypedDict
import logging

logger = logging.getLogger(__name__)


class PairingEntry(TypedDict):
    """Single entry in computed pairing sequence"""
    type: Literal['single', 'pair']
    images: List[int]


class ImageClassificationService:
    """Service for classifying images and computing optimal pairing sequences"""
    
    # Aspect ratio thresholds
    LANDSCAPE_THRESHOLD = 1.1  # aspect_ratio > 1.1 = landscape
    PORTRAIT_THRESHOLD = 0.9   # aspect_ratio < 0.9 = portrait
    
    @classmethod
    def classify_image(cls, width: int, height: int) -> Literal['landscape', 'portrait']:
        """
        Classify an image as landscape or portrait based on aspect ratio.
        
        Args:
            width: Image width in pixels
            height: Image height in pixels
            
        Returns:
            'landscape' if aspect ratio > 1.1
            'portrait' if aspect ratio < 0.9 or aspect ratio 0.9-1.1 (square)
        """
        if width <= 0 or height <= 0:
            logger.warning(f"Invalid image dimensions: {width}x{height}, defaulting to portrait")
            return 'portrait'
        
        aspect_ratio = width / height
        
        if aspect_ratio > cls.LANDSCAPE_THRESHOLD:
            return 'landscape'
        # Both portrait and square (0.9-1.1) are treated as portrait
        return 'portrait'
    
    @classmethod
    def compute_portrait_sequence(cls, images: List[Dict]) -> List[PairingEntry]:
        """
        Compute optimal pairing sequence for portrait display.
        
        Portrait Display Logic:
        - Pair landscape images (2 per screen)
        - Display portrait/square images singularly (1 per screen)
        
        Args:
            images: List of image dicts with 'id', 'width', 'height' keys
            
        Returns:
            List of PairingEntry objects describing the pairing structure
        """
        result: List[PairingEntry] = []
        landscape_buffer: List[Dict] = []
        
        for image in images:
            image_type = cls.classify_image(image['width'], image['height'])
            
            if image_type == 'landscape':
                landscape_buffer.append(image)
                
                # Pair when we have 2 landscapes
                if len(landscape_buffer) == 2:
                    result.append({
                        'type': 'pair',
                        'images': [landscape_buffer[0]['id'], landscape_buffer[1]['id']]
                    })
                    landscape_buffer.clear()
            else:
                # Portrait or square image
                # Flush any pending landscape first
                if len(landscape_buffer) == 1:
                    result.append({
                        'type': 'single',
                        'images': [landscape_buffer[0]['id']]
                    })
                    landscape_buffer.clear()
                
                # Add portrait as single
                result.append({
                    'type': 'single',
                    'images': [image['id']]
                })
        
        # Handle remaining landscape if odd number
        if len(landscape_buffer) == 1:
            result.append({
                'type': 'single',
                'images': [landscape_buffer[0]['id']]
            })
        
        return result
    
    @classmethod
    def compute_landscape_sequence(cls, images: List[Dict]) -> List[PairingEntry]:
        """
        Compute optimal pairing sequence for landscape display.
        
        Landscape Display Logic:
        - Display landscape images singularly (1 per screen)
        - Pair portrait/square images (2 per screen)
        
        Args:
            images: List of image dicts with 'id', 'width', 'height' keys
            
        Returns:
            List of PairingEntry objects describing the pairing structure
        """
        result: List[PairingEntry] = []
        portrait_buffer: List[Dict] = []
        
        for image in images:
            image_type = cls.classify_image(image['width'], image['height'])
            
            if image_type == 'portrait':
                portrait_buffer.append(image)
                
                # Pair when we have 2 portraits
                if len(portrait_buffer) == 2:
                    result.append({
                        'type': 'pair',
                        'images': [portrait_buffer[0]['id'], portrait_buffer[1]['id']]
                    })
                    portrait_buffer.clear()
            else:
                # Landscape image
                # Flush any pending portrait first
                if len(portrait_buffer) == 1:
                    result.append({
                        'type': 'single',
                        'images': [portrait_buffer[0]['id']]
                    })
                    portrait_buffer.clear()
                
                # Add landscape as single
                result.append({
                    'type': 'single',
                    'images': [image['id']]
                })
        
        # Handle remaining portrait if odd number
        if len(portrait_buffer) == 1:
            result.append({
                'type': 'single',
                'images': [portrait_buffer[0]['id']]
            })
        
        return result
    
    @classmethod
    def compute_sequence(
        cls,
        images: List[Dict],
        display_orientation: Literal['portrait', 'landscape']
    ) -> List[PairingEntry]:
        """
        Compute optimal pairing sequence based on display orientation.
        
        Args:
            images: List of image dicts with 'id', 'width', 'height' keys
            display_orientation: 'portrait' or 'landscape'
            
        Returns:
            List of PairingEntry objects describing the pairing structure
        """
        if not images:
            return []
        
        if display_orientation == 'portrait':
            return cls.compute_portrait_sequence(images)
        else:
            return cls.compute_landscape_sequence(images)
    
    @classmethod
    def validate_sequence_consistency(
        cls,
        sequence: List[int],
        images: List[Dict],
        display_orientation: Literal['portrait', 'landscape']
    ) -> Dict:
        """
        Validate that a manual sequence maintains optimal pairing.
        
        Computes the globally optimal sequence (by grouping pairable images)
        and compares it to the user's sequence.
        
        Args:
            sequence: User's manual image ID sequence
            images: Full list of image metadata
            display_orientation: Display orientation
            
        Returns:
            Dict with 'is_valid', 'errors', 'optimal_sequence', 'optimal_computed' keys
        """
        # Create image map
        image_map = {img['id']: img for img in images}
        ordered_images = [image_map[img_id] for img_id in sequence if img_id in image_map]
        
        # Compute what the user's sequence produces
        user_computed = cls.compute_sequence(ordered_images, display_orientation)
        
        # Compute globally optimal by grouping pairable orientations
        # Separate by orientation
        landscapes = [img for img in ordered_images if cls.classify_image(img['width'], img['height']) == 'landscape']
        portraits = [img for img in ordered_images if cls.classify_image(img['width'], img['height']) == 'portrait']
        
        # Create optimal order: group images of pairable orientation together
        if display_orientation == 'portrait':
            # For portrait display: group landscapes together for optimal pairing
            # Portraits can be anywhere (they're always single)
            # Simple optimization: all portraits first, then all landscapes
            optimal_ordered = portraits + landscapes
        else:
            # For landscape display: group portraits together for optimal pairing
            # Landscapes can be anywhere (they're always single)
            optimal_ordered = landscapes + portraits
        
        optimal_computed = cls.compute_sequence(optimal_ordered, display_orientation)
        optimal_ids = [img_id for entry in optimal_computed for img_id in entry['images']]
        
        # Count pairs in each
        user_pairs = sum(1 for entry in user_computed if entry['type'] == 'pair')
        optimal_pairs = sum(1 for entry in optimal_computed if entry['type'] == 'pair')
        
        errors = []
        
        # If user sequence has fewer pairs than optimal, it's suboptimal
        if user_pairs < optimal_pairs:
            errors.append({
                'type': 'suboptimal_pairing',
                'message': f'Manual sequence creates {user_pairs} pairs, but {optimal_pairs} pairs are possible',
                'suggestion': 'Use auto-fix to apply optimal pairing'
            })
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'optimal_sequence': optimal_ids,
            'optimal_computed': optimal_computed
        }


# Singleton instance
image_classification_service = ImageClassificationService()


"""
Image Classification and Pairing for GlowWorm Daemon.

Provides utilities for classifying images by orientation and computing
optimal pairing sequences based on display orientation.
"""

import logging
from dataclasses import dataclass
from typing import List, Literal, Dict, Any

logger = logging.getLogger(__name__)


# Aspect ratio thresholds
LANDSCAPE_THRESHOLD = 1.1  # aspect_ratio > 1.1 = landscape
PORTRAIT_THRESHOLD = 0.9   # aspect_ratio < 0.9 = portrait (0.9-1.1 = square)


def classify_image(width: int, height: int) -> Literal['landscape', 'portrait']:
    """
    Classify an image as landscape or portrait based on aspect ratio.

    Args:
        width: Image width in pixels
        height: Image height in pixels

    Returns:
        'landscape' if aspect ratio > 1.1
        'portrait' if aspect ratio <= 1.1 (includes square)
    """
    if width is None or height is None or width <= 0 or height <= 0:
        logger.warning(f"Invalid image dimensions: {width}x{height}, defaulting to portrait")
        return 'portrait'

    aspect_ratio = width / height

    if aspect_ratio > LANDSCAPE_THRESHOLD:
        return 'landscape'
    return 'portrait'


@dataclass
class PairingEntry:
    """Single entry in computed pairing sequence."""
    entry_type: Literal['single', 'pair']
    image_ids: List[int]

    @property
    def is_pair(self) -> bool:
        return self.entry_type == 'pair'

    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': self.entry_type,
            'images': self.image_ids,
        }


def compute_portrait_sequence(images: List[Dict[str, Any]]) -> List[PairingEntry]:
    """
    Compute optimal pairing sequence for portrait display.

    Portrait Display Logic:
    - Pair landscape images (2 per screen, stacked top/bottom)
    - Display portrait/square images singularly (1 per screen)

    Args:
        images: List of dicts with 'id', 'width', 'height' keys

    Returns:
        List of PairingEntry objects describing the pairing structure
    """
    result: List[PairingEntry] = []
    landscape_buffer: List[Dict[str, Any]] = []

    for image in images:
        width = image.get('width') or 0
        height = image.get('height') or 0
        image_type = classify_image(width, height)

        if image_type == 'landscape':
            landscape_buffer.append(image)

            # Pair when we have 2 landscapes
            if len(landscape_buffer) == 2:
                result.append(PairingEntry(
                    entry_type='pair',
                    image_ids=[landscape_buffer[0]['id'], landscape_buffer[1]['id']]
                ))
                landscape_buffer.clear()
        else:
            # Portrait or square image
            # Flush any pending landscape first
            if len(landscape_buffer) == 1:
                result.append(PairingEntry(
                    entry_type='single',
                    image_ids=[landscape_buffer[0]['id']]
                ))
                landscape_buffer.clear()

            # Add portrait as single
            result.append(PairingEntry(
                entry_type='single',
                image_ids=[image['id']]
            ))

    # Handle remaining landscape if odd number
    if len(landscape_buffer) == 1:
        result.append(PairingEntry(
            entry_type='single',
            image_ids=[landscape_buffer[0]['id']]
        ))

    return result


def compute_landscape_sequence(images: List[Dict[str, Any]]) -> List[PairingEntry]:
    """
    Compute optimal pairing sequence for landscape display.

    Landscape Display Logic:
    - Display landscape images singularly (1 per screen)
    - Pair portrait/square images (2 per screen, side by side)

    Args:
        images: List of dicts with 'id', 'width', 'height' keys

    Returns:
        List of PairingEntry objects describing the pairing structure
    """
    result: List[PairingEntry] = []
    portrait_buffer: List[Dict[str, Any]] = []

    for image in images:
        width = image.get('width') or 0
        height = image.get('height') or 0
        image_type = classify_image(width, height)

        if image_type == 'portrait':
            portrait_buffer.append(image)

            # Pair when we have 2 portraits
            if len(portrait_buffer) == 2:
                result.append(PairingEntry(
                    entry_type='pair',
                    image_ids=[portrait_buffer[0]['id'], portrait_buffer[1]['id']]
                ))
                portrait_buffer.clear()
        else:
            # Landscape image
            # Flush any pending portrait first
            if len(portrait_buffer) == 1:
                result.append(PairingEntry(
                    entry_type='single',
                    image_ids=[portrait_buffer[0]['id']]
                ))
                portrait_buffer.clear()

            # Add landscape as single
            result.append(PairingEntry(
                entry_type='single',
                image_ids=[image['id']]
            ))

    # Handle remaining portrait if odd number
    if len(portrait_buffer) == 1:
        result.append(PairingEntry(
            entry_type='single',
            image_ids=[portrait_buffer[0]['id']]
        ))

    return result


def compute_pairing_sequence(
    images: List[Dict[str, Any]],
    display_orientation: Literal['portrait', 'landscape']
) -> List[PairingEntry]:
    """
    Compute optimal pairing sequence based on display orientation.

    Args:
        images: List of dicts with 'id', 'width', 'height' keys
        display_orientation: 'portrait' or 'landscape'

    Returns:
        List of PairingEntry objects describing the pairing structure
    """
    if not images:
        return []

    if display_orientation == 'portrait':
        return compute_portrait_sequence(images)
    else:
        return compute_landscape_sequence(images)


def detect_display_orientation(width: int, height: int) -> Literal['portrait', 'landscape']:
    """
    Detect display orientation from dimensions.

    Args:
        width: Display width
        height: Display height

    Returns:
        'portrait' if height > width, 'landscape' otherwise
    """
    if height > width:
        return 'portrait'
    return 'landscape'

"""
Image Classification and Pairing for GlowWorm Display Engine.

Provides utilities for classifying images by orientation and computing
optimal pairing sequences based on display orientation.
"""

import logging
from dataclasses import dataclass
from enum import Enum
from typing import List, Literal

logger = logging.getLogger(__name__)


class ImageOrientation(str, Enum):
    """Image orientation classification."""
    LANDSCAPE = "landscape"
    PORTRAIT = "portrait"


@dataclass
class PairingEntry:
    """Single entry in computed pairing sequence."""
    entry_type: Literal['single', 'pair']
    image_ids: List[int]

    @property
    def is_pair(self) -> bool:
        return self.entry_type == 'pair'

    @property
    def is_single(self) -> bool:
        return self.entry_type == 'single'


# Aspect ratio thresholds
LANDSCAPE_THRESHOLD = 1.1  # aspect_ratio > 1.1 = landscape
PORTRAIT_THRESHOLD = 0.9   # aspect_ratio < 0.9 = portrait (0.9-1.1 = square, treated as portrait)


def classify_image(width: int, height: int) -> ImageOrientation:
    """
    Classify an image as landscape or portrait based on aspect ratio.

    Args:
        width: Image width in pixels
        height: Image height in pixels

    Returns:
        ImageOrientation.LANDSCAPE if aspect ratio > 1.1
        ImageOrientation.PORTRAIT if aspect ratio <= 1.1 (includes square)
    """
    if width <= 0 or height <= 0:
        logger.warning(f"Invalid image dimensions: {width}x{height}, defaulting to portrait")
        return ImageOrientation.PORTRAIT

    aspect_ratio = width / height

    if aspect_ratio > LANDSCAPE_THRESHOLD:
        return ImageOrientation.LANDSCAPE
    # Both portrait and square (0.9-1.1) are treated as portrait
    return ImageOrientation.PORTRAIT


def should_be_paired(
    image_width: int,
    image_height: int,
    display_orientation: Literal['portrait', 'landscape']
) -> bool:
    """
    Check if an image should ideally be paired based on display orientation.

    Args:
        image_width: Image width in pixels
        image_height: Image height in pixels
        display_orientation: Display orientation ('portrait' or 'landscape')

    Returns:
        True if the image should be paired, False otherwise
    """
    image_type = classify_image(image_width, image_height)

    # Portrait display: landscapes should be paired (stacked top/bottom)
    if display_orientation == 'portrait':
        return image_type == ImageOrientation.LANDSCAPE

    # Landscape display: portraits should be paired (side by side)
    return image_type == ImageOrientation.PORTRAIT


@dataclass
class ImageInfo:
    """Image information for pairing calculations."""
    id: int
    width: int
    height: int

    @property
    def orientation(self) -> ImageOrientation:
        return classify_image(self.width, self.height)

    @property
    def is_landscape(self) -> bool:
        return self.orientation == ImageOrientation.LANDSCAPE

    @property
    def is_portrait(self) -> bool:
        return self.orientation == ImageOrientation.PORTRAIT

    @property
    def aspect_ratio(self) -> float:
        if self.height <= 0:
            return 1.0
        return self.width / self.height


def compute_portrait_sequence(images: List[ImageInfo]) -> List[PairingEntry]:
    """
    Compute optimal pairing sequence for portrait display.

    Portrait Display Logic:
    - Pair landscape images (2 per screen, stacked top/bottom)
    - Display portrait/square images singularly (1 per screen)

    Args:
        images: List of ImageInfo objects

    Returns:
        List of PairingEntry objects describing the pairing structure
    """
    result: List[PairingEntry] = []
    landscape_buffer: List[ImageInfo] = []

    for image in images:
        if image.is_landscape:
            landscape_buffer.append(image)

            # Pair when we have 2 landscapes
            if len(landscape_buffer) == 2:
                result.append(PairingEntry(
                    entry_type='pair',
                    image_ids=[landscape_buffer[0].id, landscape_buffer[1].id]
                ))
                landscape_buffer.clear()
        else:
            # Portrait or square image
            # Flush any pending landscape first
            if len(landscape_buffer) == 1:
                result.append(PairingEntry(
                    entry_type='single',
                    image_ids=[landscape_buffer[0].id]
                ))
                landscape_buffer.clear()

            # Add portrait as single
            result.append(PairingEntry(
                entry_type='single',
                image_ids=[image.id]
            ))

    # Handle remaining landscape if odd number
    if len(landscape_buffer) == 1:
        result.append(PairingEntry(
            entry_type='single',
            image_ids=[landscape_buffer[0].id]
        ))

    return result


def compute_landscape_sequence(images: List[ImageInfo]) -> List[PairingEntry]:
    """
    Compute optimal pairing sequence for landscape display.

    Landscape Display Logic:
    - Display landscape images singularly (1 per screen)
    - Pair portrait/square images (2 per screen, side by side)

    Args:
        images: List of ImageInfo objects

    Returns:
        List of PairingEntry objects describing the pairing structure
    """
    result: List[PairingEntry] = []
    portrait_buffer: List[ImageInfo] = []

    for image in images:
        if image.is_portrait:
            portrait_buffer.append(image)

            # Pair when we have 2 portraits
            if len(portrait_buffer) == 2:
                result.append(PairingEntry(
                    entry_type='pair',
                    image_ids=[portrait_buffer[0].id, portrait_buffer[1].id]
                ))
                portrait_buffer.clear()
        else:
            # Landscape image
            # Flush any pending portrait first
            if len(portrait_buffer) == 1:
                result.append(PairingEntry(
                    entry_type='single',
                    image_ids=[portrait_buffer[0].id]
                ))
                portrait_buffer.clear()

            # Add landscape as single
            result.append(PairingEntry(
                entry_type='single',
                image_ids=[image.id]
            ))

    # Handle remaining portrait if odd number
    if len(portrait_buffer) == 1:
        result.append(PairingEntry(
            entry_type='single',
            image_ids=[portrait_buffer[0].id]
        ))

    return result


def compute_pairing_sequence(
    images: List[ImageInfo],
    display_orientation: Literal['portrait', 'landscape']
) -> List[PairingEntry]:
    """
    Compute optimal pairing sequence based on display orientation.

    Args:
        images: List of ImageInfo objects
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

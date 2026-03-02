"""
Saliency Detection Service for Smart Cropping.

Detects the most visually interesting region of an image to determine
the optimal focus point for cropping. Uses a hybrid approach:
1. Face detection (highest priority for photos with people)
2. OpenCV saliency detection (fallback for other subjects)

The focus point is stored as (x, y) coordinates from 0.0 to 1.0,
representing the percentage from the top-left corner.
"""

import logging
from pathlib import Path
from typing import Optional, Tuple
import io

import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# Load face detection classifier (Haar cascade - fast and reliable)
FACE_CASCADE_PATH = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'


class SaliencyService:
    """Service for detecting focus points in images."""

    def __init__(self):
        """Initialize the saliency service."""
        self._face_cascade = None
        self._saliency = None

    @property
    def face_cascade(self) -> cv2.CascadeClassifier:
        """Lazy-load face cascade classifier."""
        if self._face_cascade is None:
            self._face_cascade = cv2.CascadeClassifier(FACE_CASCADE_PATH)
            if self._face_cascade.empty():
                logger.warning("Failed to load face cascade classifier")
        return self._face_cascade

    @property
    def saliency_detector(self):
        """Lazy-load saliency detector."""
        if self._saliency is None:
            # Use Spectral Residual - fast and effective
            self._saliency = cv2.saliency.StaticSaliencySpectralResidual_create()
        return self._saliency

    def detect_focus_point(
        self,
        image_path: Optional[Path] = None,
        image_bytes: Optional[bytes] = None,
        pil_image: Optional[Image.Image] = None,
    ) -> Tuple[float, float]:
        """
        Detect the optimal focus point for an image.

        Uses a hybrid approach:
        1. Try face detection first (best for photos with people)
        2. Fall back to saliency detection for other subjects
        3. Default to center (0.5, 0.5) if detection fails

        Args:
            image_path: Path to image file
            image_bytes: Raw image bytes
            pil_image: PIL Image object

        Returns:
            Tuple of (focus_x, focus_y) where each is 0.0 to 1.0
        """
        try:
            # Load image as OpenCV array
            cv_image = self._load_image(image_path, image_bytes, pil_image)
            if cv_image is None:
                logger.warning("Failed to load image for saliency detection")
                return (0.5, 0.5)

            height, width = cv_image.shape[:2]

            # Try face detection first
            focus = self._detect_faces(cv_image, width, height)
            if focus is not None:
                logger.debug(f"Focus point from faces: {focus}")
                return focus

            # Fall back to saliency detection
            focus = self._detect_saliency(cv_image, width, height)
            if focus is not None:
                logger.debug(f"Focus point from saliency: {focus}")
                return focus

            # Default to center
            logger.debug("No focus point detected, using center")
            return (0.5, 0.5)

        except Exception as e:
            logger.error(f"Error detecting focus point: {e}")
            return (0.5, 0.5)

    def _load_image(
        self,
        image_path: Optional[Path],
        image_bytes: Optional[bytes],
        pil_image: Optional[Image.Image],
    ) -> Optional[np.ndarray]:
        """Load image as OpenCV array from various sources."""
        try:
            if image_path is not None:
                # Load from file
                cv_image = cv2.imread(str(image_path))
                return cv_image

            if image_bytes is not None:
                # Load from bytes
                nparr = np.frombuffer(image_bytes, np.uint8)
                cv_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                return cv_image

            if pil_image is not None:
                # Convert PIL to OpenCV
                if pil_image.mode != 'RGB':
                    pil_image = pil_image.convert('RGB')
                cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
                return cv_image

            return None

        except Exception as e:
            logger.error(f"Error loading image: {e}")
            return None

    def _detect_faces(
        self,
        cv_image: np.ndarray,
        width: int,
        height: int,
    ) -> Optional[Tuple[float, float]]:
        """
        Detect faces and return centroid of all faces.

        Args:
            cv_image: OpenCV image array
            width: Image width
            height: Image height

        Returns:
            Focus point tuple or None if no faces found
        """
        try:
            # Convert to grayscale for face detection
            gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)

            # Detect faces
            faces = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(30, 30),
            )

            if len(faces) == 0:
                return None

            # Calculate centroid of all faces
            total_x = 0
            total_y = 0
            total_weight = 0

            for (x, y, w, h) in faces:
                # Weight by face size (larger faces = more important)
                weight = w * h
                center_x = x + w / 2
                center_y = y + h / 2
                total_x += center_x * weight
                total_y += center_y * weight
                total_weight += weight

            if total_weight > 0:
                focus_x = (total_x / total_weight) / width
                focus_y = (total_y / total_weight) / height
                # Clamp to valid range
                focus_x = max(0.0, min(1.0, focus_x))
                focus_y = max(0.0, min(1.0, focus_y))
                logger.info(f"Detected {len(faces)} face(s), focus: ({focus_x:.2f}, {focus_y:.2f})")
                return (focus_x, focus_y)

            return None

        except Exception as e:
            logger.warning(f"Face detection failed: {e}")
            return None

    def _detect_saliency(
        self,
        cv_image: np.ndarray,
        width: int,
        height: int,
    ) -> Optional[Tuple[float, float]]:
        """
        Detect salient region and return its centroid.

        Args:
            cv_image: OpenCV image array
            width: Image width
            height: Image height

        Returns:
            Focus point tuple or None if detection fails
        """
        try:
            # Compute saliency map
            success, saliency_map = self.saliency_detector.computeSaliency(cv_image)
            if not success or saliency_map is None:
                return None

            # Normalize to 0-255 range
            saliency_map = (saliency_map * 255).astype(np.uint8)

            # Threshold to get high-saliency regions
            _, thresh = cv2.threshold(
                saliency_map, 0, 255,
                cv2.THRESH_BINARY + cv2.THRESH_OTSU
            )

            # Find contours of salient regions
            contours, _ = cv2.findContours(
                thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )

            if not contours:
                # Fall back to weighted centroid of saliency map
                return self._saliency_weighted_centroid(saliency_map, width, height)

            # Find the largest salient region
            largest_contour = max(contours, key=cv2.contourArea)

            # Get centroid of largest region
            M = cv2.moments(largest_contour)
            if M["m00"] > 0:
                cx = M["m10"] / M["m00"]
                cy = M["m01"] / M["m00"]
                focus_x = cx / width
                focus_y = cy / height
                # Clamp to valid range
                focus_x = max(0.0, min(1.0, focus_x))
                focus_y = max(0.0, min(1.0, focus_y))
                logger.info(f"Saliency focus: ({focus_x:.2f}, {focus_y:.2f})")
                return (focus_x, focus_y)

            return None

        except Exception as e:
            logger.warning(f"Saliency detection failed: {e}")
            return None

    def _saliency_weighted_centroid(
        self,
        saliency_map: np.ndarray,
        width: int,
        height: int,
    ) -> Optional[Tuple[float, float]]:
        """
        Calculate weighted centroid of saliency map.

        Fallback when contour detection doesn't work well.
        """
        try:
            # Create coordinate grids
            y_coords, x_coords = np.mgrid[0:height, 0:width]

            # Calculate weighted centroid
            total_saliency = saliency_map.sum()
            if total_saliency == 0:
                return None

            cx = (x_coords * saliency_map).sum() / total_saliency
            cy = (y_coords * saliency_map).sum() / total_saliency

            focus_x = cx / width
            focus_y = cy / height
            # Clamp to valid range
            focus_x = max(0.0, min(1.0, focus_x))
            focus_y = max(0.0, min(1.0, focus_y))

            return (focus_x, focus_y)

        except Exception as e:
            logger.warning(f"Weighted centroid calculation failed: {e}")
            return None


# Singleton instance
saliency_service = SaliencyService()

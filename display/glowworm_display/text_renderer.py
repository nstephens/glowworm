"""
Text Renderer for GlowWorm Display Engine.

Provides text display capabilities for registration codes and status messages.
Uses Pi3D's PointText/String classes for GPU-accelerated text rendering.
"""

import logging
import math
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import pi3d

logger = logging.getLogger(__name__)


@dataclass
class TextStyle:
    """Style configuration for text rendering."""

    color: tuple[float, float, float, float] = (1.0, 1.0, 1.0, 1.0)
    scale: float = 1.0
    shadow: bool = False
    shadow_color: tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.5)
    shadow_offset: tuple[float, float] = (2.0, -2.0)


class MockFont:
    """Mock font for development/testing without Pi3D hardware."""

    def __init__(self, font_path: str = "", font_size: int = 48) -> None:
        self.font_path = font_path
        self.font_size = font_size
        logger.info(f"MockFont initialized: size={font_size}")


class MockText:
    """Mock text object for development/testing without Pi3D hardware."""

    def __init__(
        self,
        text: str,
        x: float = 0.0,
        y: float = 0.0,
        z: float = 0.0,
        color: tuple[float, float, float, float] = (1.0, 1.0, 1.0, 1.0),
        scale: float = 1.0,
    ) -> None:
        self.text = text
        self.x = x
        self.y = y
        self.z = z
        self.color = color
        self.scale = scale
        self._alpha = 1.0
        logger.debug(f"MockText created: '{text}' at ({x}, {y})")

    def set_text(self, text: str) -> None:
        """Update the text content."""
        self.text = text
        logger.debug(f"MockText updated: '{text}'")

    def position(self, x: float, y: float, z: float = 0.0) -> None:
        """Set the position of the text."""
        self.x = x
        self.y = y
        self.z = z

    def set_alpha(self, alpha: float) -> None:
        """Set the alpha transparency."""
        self._alpha = alpha

    def draw(self) -> None:
        """Draw the text (no-op in mock mode)."""
        pass


class TextRenderer:
    """
    GPU-accelerated text renderer using Pi3D.

    Provides methods for displaying text on screen, including
    registration codes with animated waiting indicators.

    Attributes:
        display_width: Width of the display in pixels
        display_height: Height of the display in pixels
        mock: Whether running in mock mode
    """

    def __init__(
        self,
        display_width: int,
        display_height: int,
        mock: bool = False,
    ) -> None:
        """
        Initialize the text renderer.

        Args:
            display_width: Display width in pixels
            display_height: Display height in pixels
            mock: If True, use mock rendering for development
        """
        self.display_width = display_width
        self.display_height = display_height
        self.mock = mock

        # Font instances
        self._code_font: "pi3d.Font | MockFont | None" = None
        self._label_font: "pi3d.Font | MockFont | None" = None

        # Current registration display state
        self._registration_code: str | None = None
        self._code_text: "pi3d.String | MockText | None" = None
        self._label_text: "pi3d.String | MockText | None" = None
        self._waiting_dots: list["pi3d.String | MockText"] = []

        # Animation state
        self._animation_start: float = 0.0
        self._pulse_period: float = 2.0  # seconds for full pulse cycle
        self._dot_period: float = 0.5  # seconds per dot animation

        # Error display state
        self._error_message: str | None = None
        self._error_code: str | None = None
        self._error_text: "pi3d.String | MockText | None" = None
        self._error_code_text: "pi3d.String | MockText | None" = None
        self._error_animation_start: float = 0.0

        logger.info(f"TextRenderer initialized: {display_width}x{display_height}, mock={mock}")

    def _get_code_font(self) -> "pi3d.Font | MockFont":
        """Get or create the font for registration codes."""
        if self._code_font is not None:
            return self._code_font

        if self.mock:
            self._code_font = MockFont(font_size=200)
        else:
            import pi3d
            # Use default font - will try to find a system monospace font
            # Scale calculation: aim for code to be about 1/4 display height
            self._code_font = pi3d.Font(
                "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
                color=(1.0, 1.0, 1.0, 1.0),
                font_size=200,
            )

        return self._code_font

    def _get_label_font(self) -> "pi3d.Font | MockFont":
        """Get or create the font for labels."""
        if self._label_font is not None:
            return self._label_font

        if self.mock:
            self._label_font = MockFont(font_size=48)
        else:
            import pi3d
            self._label_font = pi3d.Font(
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                color=(0.8, 0.8, 0.8, 1.0),
                font_size=48,
            )

        return self._label_font

    def set_registration_code(self, code: str) -> None:
        """
        Set the registration code to display.

        Creates text objects for the code and label if needed,
        and starts the waiting animation.

        Args:
            code: The 4-character registration code to display
        """
        self._registration_code = code.upper()
        self._animation_start = time.time()

        # Create or update text objects
        self._create_registration_display()

        logger.info(f"Registration code set: {self._registration_code}")

    def _create_registration_display(self) -> None:
        """Create text objects for registration display."""
        if self._registration_code is None:
            return

        code_font = self._get_code_font()
        label_font = self._get_label_font()

        # Position calculations - center the display
        center_x = 0  # Pi3D uses center-origin coordinates
        code_y = self.display_height * 0.05  # Slightly above center
        label_y = code_y + self.display_height * 0.2  # Above the code
        dots_y = code_y - self.display_height * 0.2  # Below the code

        if self.mock:
            # Create mock text objects
            self._code_text = MockText(
                text=self._registration_code,
                x=center_x,
                y=code_y,
                scale=3.0,
            )
            self._label_text = MockText(
                text="Enter this code to register your device:",
                x=center_x,
                y=label_y,
                scale=1.0,
            )
            # Create waiting dots
            self._waiting_dots = []
            dot_spacing = 30
            for i in range(3):
                dot = MockText(
                    text=".",
                    x=center_x + (i - 1) * dot_spacing,
                    y=dots_y,
                    scale=1.5,
                )
                self._waiting_dots.append(dot)
        else:
            import pi3d

            # Create Pi3D String objects
            self._code_text = pi3d.String(
                font=code_font,
                string=self._registration_code,
                x=center_x,
                y=code_y,
                z=1.0,
                justify="C",
            )
            # Scale up the code text
            self._code_text.set_shader(pi3d.Shader("uv_flat"))

            self._label_text = pi3d.String(
                font=label_font,
                string="Enter this code to register your device:",
                x=center_x,
                y=label_y,
                z=1.0,
                justify="C",
            )
            self._label_text.set_shader(pi3d.Shader("uv_flat"))

            # Create waiting dots
            self._waiting_dots = []
            dot_spacing = 50
            for i in range(3):
                dot = pi3d.String(
                    font=label_font,
                    string=".",
                    x=center_x + (i - 1) * dot_spacing,
                    y=dots_y,
                    z=1.0,
                    justify="C",
                )
                dot.set_shader(pi3d.Shader("uv_flat"))
                self._waiting_dots.append(dot)

        logger.debug("Registration display created")

    def clear_registration(self) -> None:
        """Clear the registration display."""
        self._registration_code = None
        self._code_text = None
        self._label_text = None
        self._waiting_dots = []
        logger.info("Registration display cleared")

    def render_registration(self) -> bool:
        """
        Render the registration display.

        Draws the registration code, label, and animated waiting indicator.
        Call this each frame when in registration mode.

        Returns:
            True if there is a registration code to display, False otherwise
        """
        if self._registration_code is None or self._code_text is None:
            return False

        current_time = time.time()
        elapsed = current_time - self._animation_start

        # Calculate pulse alpha (gentle fade between 0.7 and 1.0)
        pulse = 0.85 + 0.15 * math.sin(elapsed * 2 * math.pi / self._pulse_period)

        # Draw label (static)
        if self._label_text:
            self._label_text.draw()

        # Draw code with pulse effect
        self._code_text.set_alpha(pulse)
        self._code_text.draw()

        # Animate waiting dots
        for i, dot in enumerate(self._waiting_dots):
            # Stagger the dot animations
            dot_phase = (elapsed / self._dot_period + i * 0.33) % 1.0
            # Fade in and out
            dot_alpha = 0.3 + 0.7 * (0.5 + 0.5 * math.sin(dot_phase * 2 * math.pi))
            dot.set_alpha(dot_alpha)
            dot.draw()

        return True

    @property
    def has_registration(self) -> bool:
        """Check if a registration code is currently set."""
        return self._registration_code is not None

    @property
    def current_code(self) -> str | None:
        """Get the current registration code, if any."""
        return self._registration_code

    def set_error_message(self, message: str, code: str = "ERROR") -> None:
        """
        Set an error message to display.

        Creates text objects for the error message display.
        Shows a user-friendly error message with an error code.

        Args:
            message: User-friendly error message
            code: Error code for display (e.g., "NETWORK", "IMAGE")
        """
        self._error_message = message
        self._error_code = code
        self._error_animation_start = time.time()

        # Create error display text objects
        self._create_error_display()

        logger.info(f"Error message set: [{code}] {message}")

    def _create_error_display(self) -> None:
        """Create text objects for error display."""
        if self._error_message is None:
            return

        label_font = self._get_label_font()

        # Position calculations - center the display
        center_x = 0  # Pi3D uses center-origin coordinates
        message_y = 0  # Center of screen
        code_y = message_y + self.display_height * 0.15  # Above the message

        # Wrap long messages (max ~40 characters per line)
        wrapped_message = self._wrap_text(self._error_message, 40)

        if self.mock:
            # Create mock text objects
            self._error_code_text = MockText(
                text=f"Error: {self._error_code}",
                x=center_x,
                y=code_y,
                scale=1.2,
                color=(1.0, 0.4, 0.4, 1.0),  # Reddish
            )
            self._error_text = MockText(
                text=wrapped_message,
                x=center_x,
                y=message_y,
                scale=1.0,
            )
        else:
            import pi3d

            # Error code heading (red/warning color)
            self._error_code_text = pi3d.String(
                font=label_font,
                string=f"Error: {self._error_code}",
                x=center_x,
                y=code_y,
                z=1.0,
                justify="C",
            )
            self._error_code_text.set_shader(pi3d.Shader("uv_flat"))

            # Error message (white)
            self._error_text = pi3d.String(
                font=label_font,
                string=wrapped_message,
                x=center_x,
                y=message_y,
                z=1.0,
                justify="C",
            )
            self._error_text.set_shader(pi3d.Shader("uv_flat"))

        logger.debug("Error display created")

    def _wrap_text(self, text: str, max_chars: int = 40) -> str:
        """Wrap text to fit within max characters per line."""
        words = text.split()
        lines = []
        current_line = []
        current_length = 0

        for word in words:
            if current_length + len(word) + 1 > max_chars and current_line:
                lines.append(" ".join(current_line))
                current_line = [word]
                current_length = len(word)
            else:
                current_line.append(word)
                current_length += len(word) + 1

        if current_line:
            lines.append(" ".join(current_line))

        return "\n".join(lines)

    def clear_error(self) -> None:
        """Clear the error display."""
        self._error_message = None
        self._error_code = None
        self._error_text = None
        self._error_code_text = None
        logger.info("Error display cleared")

    def render_error(self) -> bool:
        """
        Render the error display.

        Draws the error message with a subtle pulsing animation.
        Call this each frame when in error mode.

        Returns:
            True if there is an error to display, False otherwise
        """
        if self._error_message is None or self._error_text is None:
            return False

        current_time = time.time()
        elapsed = current_time - self._error_animation_start

        # Calculate pulse alpha for error code (pulsing red warning)
        pulse = 0.7 + 0.3 * math.sin(elapsed * 2 * math.pi / 1.5)

        # Draw error code heading with pulse effect
        if self._error_code_text:
            self._error_code_text.set_alpha(pulse)
            self._error_code_text.draw()

        # Draw error message (static)
        self._error_text.set_alpha(0.9)
        self._error_text.draw()

        return True

    @property
    def has_error(self) -> bool:
        """Check if an error message is currently set."""
        return self._error_message is not None

    @property
    def current_error_message(self) -> str | None:
        """Get the current error message, if any."""
        return self._error_message

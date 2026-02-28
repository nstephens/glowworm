"""
Base transition class for GlowWorm Display Engine.

Provides the abstract interface that all transitions must implement.
"""

import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    import pi3d
    from glowworm_display.image_loader import MockSprite

logger = logging.getLogger(__name__)


class TransitionState(str, Enum):
    """State of a transition."""

    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


@dataclass
class TransitionProgress:
    """
    Progress information for a transition.

    Attributes:
        progress: Normalized progress from 0.0 to 1.0
        elapsed: Time elapsed in seconds
        remaining: Estimated time remaining in seconds
        state: Current state of the transition
    """

    progress: float
    elapsed: float
    remaining: float
    state: TransitionState


# Type for progress callback
ProgressCallback = Callable[[TransitionProgress], None]


class Transition(ABC):
    """
    Abstract base class for image transitions.

    Transitions are responsible for smoothly animating from one image
    to another over a specified duration.

    Attributes:
        duration: Duration of the transition in seconds
        state: Current state of the transition
    """

    def __init__(
        self,
        duration: float = 1.0,
        on_progress: ProgressCallback | None = None,
    ) -> None:
        """
        Initialize the transition.

        Args:
            duration: Duration of the transition in seconds
            on_progress: Optional callback for progress updates
        """
        self.duration = max(0.0, duration)
        self.on_progress = on_progress
        self._state = TransitionState.IDLE
        self._start_time: float | None = None
        self._current_progress = 0.0

    @property
    def state(self) -> TransitionState:
        """Get the current transition state."""
        return self._state

    @property
    def progress(self) -> float:
        """Get the current transition progress (0.0 to 1.0)."""
        return self._current_progress

    @property
    def is_running(self) -> bool:
        """Check if the transition is currently running."""
        return self._state == TransitionState.RUNNING

    @property
    def is_complete(self) -> bool:
        """Check if the transition has completed."""
        return self._state in (TransitionState.COMPLETED, TransitionState.CANCELLED)

    def start(self) -> None:
        """
        Start the transition.

        Resets state and begins timing.
        """
        self._state = TransitionState.RUNNING
        self._start_time = time.time()
        self._current_progress = 0.0
        logger.debug(f"Transition started: duration={self.duration}s")

    def cancel(self) -> None:
        """
        Cancel the transition.

        Stops the transition at its current position.
        """
        if self._state == TransitionState.RUNNING:
            self._state = TransitionState.CANCELLED
            logger.debug(f"Transition cancelled at {self._current_progress:.1%}")

    def update(self) -> TransitionProgress:
        """
        Update the transition state.

        Calculates current progress based on elapsed time and
        invokes progress callback if set.

        Returns:
            TransitionProgress with current state

        Raises:
            RuntimeError: If transition hasn't been started
        """
        if self._start_time is None:
            raise RuntimeError("Transition not started. Call start() first.")

        if self._state != TransitionState.RUNNING:
            # Already completed or cancelled
            return TransitionProgress(
                progress=self._current_progress,
                elapsed=time.time() - self._start_time,
                remaining=0.0,
                state=self._state,
            )

        elapsed = time.time() - self._start_time

        if self.duration <= 0:
            # Instant transition
            self._current_progress = 1.0
            self._state = TransitionState.COMPLETED
        elif elapsed >= self.duration:
            # Transition complete
            self._current_progress = 1.0
            self._state = TransitionState.COMPLETED
            logger.debug("Transition completed")
        else:
            # Calculate normalized progress
            self._current_progress = elapsed / self.duration

        # Apply easing function
        eased_progress = self._ease(self._current_progress)

        remaining = max(0.0, self.duration - elapsed)

        progress_info = TransitionProgress(
            progress=eased_progress,
            elapsed=elapsed,
            remaining=remaining,
            state=self._state,
        )

        # Invoke callback if set
        if self.on_progress:
            try:
                self.on_progress(progress_info)
            except Exception as e:
                logger.warning(f"Progress callback error: {e}")

        return progress_info

    def _ease(self, t: float) -> float:
        """
        Apply easing function to progress value.

        Default implementation uses linear easing.
        Override in subclasses for different easing curves.

        Args:
            t: Linear progress from 0.0 to 1.0

        Returns:
            Eased progress value from 0.0 to 1.0
        """
        return t

    @abstractmethod
    def render(
        self,
        current_sprite: "MockSprite | pi3d.Sprite | None",
        next_sprite: "MockSprite | pi3d.Sprite | None",
    ) -> None:
        """
        Render the current frame of the transition.

        This method should be called each frame during the transition.
        It must handle updating sprite properties (alpha, position, etc.)
        and drawing them in the correct order.

        Args:
            current_sprite: The outgoing image sprite (may be None)
            next_sprite: The incoming image sprite (may be None)
        """
        pass

    def reset(self) -> None:
        """
        Reset the transition to its initial state.

        Allows reusing the transition instance.
        """
        self._state = TransitionState.IDLE
        self._start_time = None
        self._current_progress = 0.0


def ease_in_out_cubic(t: float) -> float:
    """
    Cubic ease-in-out function.

    Provides smooth acceleration and deceleration.

    Args:
        t: Linear progress from 0.0 to 1.0

    Returns:
        Eased progress value from 0.0 to 1.0
    """
    if t < 0.5:
        return 4 * t * t * t
    else:
        return 1 - pow(-2 * t + 2, 3) / 2


def ease_out_quad(t: float) -> float:
    """
    Quadratic ease-out function.

    Provides deceleration at the end.

    Args:
        t: Linear progress from 0.0 to 1.0

    Returns:
        Eased progress value from 0.0 to 1.0
    """
    return 1 - (1 - t) * (1 - t)

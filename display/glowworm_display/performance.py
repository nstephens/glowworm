"""
Performance Monitoring for GlowWorm Display Engine.

Provides real-time performance metrics including:
- FPS tracking with rolling average
- Memory usage monitoring
- Frame timing statistics
- Texture memory tracking
- Performance logging and alerts
"""

import gc
import logging
import os
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Callable, Deque, Optional

logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetrics:
    """Current performance metrics snapshot."""

    # Frame timing
    current_fps: float = 0.0
    avg_fps: float = 0.0
    min_fps: float = float("inf")
    max_fps: float = 0.0
    frame_count: int = 0

    # Frame time in milliseconds
    last_frame_time_ms: float = 0.0
    avg_frame_time_ms: float = 0.0
    min_frame_time_ms: float = float("inf")
    max_frame_time_ms: float = 0.0

    # Memory usage in MB
    process_memory_mb: float = 0.0
    texture_memory_mb: float = 0.0
    peak_memory_mb: float = 0.0

    # Texture tracking
    active_textures: int = 0
    texture_loads: int = 0
    texture_unloads: int = 0

    # Performance health
    dropped_frames: int = 0
    gc_collections: int = 0
    uptime_seconds: float = 0.0

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            "fps": {
                "current": round(self.current_fps, 1),
                "avg": round(self.avg_fps, 1),
                "min": round(self.min_fps, 1) if self.min_fps != float("inf") else 0.0,
                "max": round(self.max_fps, 1),
            },
            "frame_time_ms": {
                "last": round(self.last_frame_time_ms, 2),
                "avg": round(self.avg_frame_time_ms, 2),
                "min": round(self.min_frame_time_ms, 2) if self.min_frame_time_ms != float("inf") else 0.0,
                "max": round(self.max_frame_time_ms, 2),
            },
            "memory_mb": {
                "process": round(self.process_memory_mb, 1),
                "texture": round(self.texture_memory_mb, 1),
                "peak": round(self.peak_memory_mb, 1),
            },
            "textures": {
                "active": self.active_textures,
                "loads": self.texture_loads,
                "unloads": self.texture_unloads,
            },
            "health": {
                "frame_count": self.frame_count,
                "dropped_frames": self.dropped_frames,
                "gc_collections": self.gc_collections,
                "uptime_seconds": round(self.uptime_seconds, 1),
            },
        }


@dataclass
class PerformanceConfig:
    """Configuration for performance monitoring."""

    # Target frame rate
    target_fps: int = 30

    # Rolling window size for FPS averaging
    fps_window_size: int = 60

    # Memory check interval in frames
    memory_check_interval: int = 30

    # Log interval in seconds (0 = disabled)
    log_interval_seconds: float = 60.0

    # Alert thresholds
    fps_alert_threshold: float = 25.0  # Alert if FPS drops below
    memory_alert_threshold_mb: float = 180.0  # Alert if memory exceeds
    frame_time_alert_ms: float = 50.0  # Alert if frame takes longer

    # Enable GC optimization
    optimize_gc: bool = True


# Callback type for performance alerts
PerformanceAlertCallback = Callable[[str, dict], None]


class PerformanceMonitor:
    """
    Performance monitoring for the display engine.

    Tracks FPS, memory usage, frame timing, and texture metrics.
    Provides alerts when performance degrades.

    Usage:
        monitor = PerformanceMonitor()
        monitor.start()

        # In render loop
        monitor.frame_start()
        # ... render ...
        monitor.frame_end()

        # Get metrics
        metrics = monitor.get_metrics()
    """

    def __init__(
        self,
        config: PerformanceConfig | None = None,
        on_alert: PerformanceAlertCallback | None = None,
    ) -> None:
        """
        Initialize performance monitor.

        Args:
            config: Performance monitoring configuration
            on_alert: Optional callback for performance alerts
        """
        self.config = config or PerformanceConfig()
        self.on_alert = on_alert

        # Frame timing
        self._frame_times: Deque[float] = deque(maxlen=self.config.fps_window_size)
        self._frame_start_time: float = 0.0
        self._last_frame_end: float = 0.0
        self._frame_count: int = 0

        # Memory tracking
        self._peak_memory: float = 0.0
        self._texture_memory: float = 0.0
        self._frames_since_memory_check: int = 0

        # Texture tracking
        self._active_textures: int = 0
        self._texture_loads: int = 0
        self._texture_unloads: int = 0

        # Dropped frames tracking
        self._dropped_frames: int = 0
        self._target_frame_time: float = 1.0 / self.config.target_fps

        # GC tracking
        self._gc_collections: int = 0
        self._initial_gc_counts: tuple = (0, 0, 0)

        # Timing
        self._start_time: float = 0.0
        self._last_log_time: float = 0.0

        # Stats accumulators
        self._min_fps: float = float("inf")
        self._max_fps: float = 0.0
        self._min_frame_time: float = float("inf")
        self._max_frame_time: float = 0.0

        # Running state
        self._running: bool = False

        logger.debug("PerformanceMonitor initialized")

    def start(self) -> None:
        """Start performance monitoring."""
        self._start_time = time.time()
        self._last_log_time = self._start_time
        self._last_frame_end = self._start_time
        self._running = True

        # Record initial GC counts
        self._initial_gc_counts = tuple(gc.get_count())

        # Optimize GC if configured
        if self.config.optimize_gc:
            self._optimize_gc()

        logger.info("Performance monitoring started")

    def stop(self) -> None:
        """Stop performance monitoring."""
        self._running = False
        logger.info(
            f"Performance monitoring stopped: "
            f"{self._frame_count} frames, "
            f"avg FPS: {self._get_avg_fps():.1f}"
        )

    def _optimize_gc(self) -> None:
        """
        Optimize garbage collection for real-time rendering.

        Disables automatic GC and relies on manual collection
        during idle periods to avoid GC pauses during transitions.
        """
        # Get current GC thresholds
        thresholds = gc.get_threshold()

        # Set higher thresholds to reduce GC frequency
        # This trades memory for smoother frame times
        gc.set_threshold(
            thresholds[0] * 3,  # Generation 0: triple threshold
            thresholds[1] * 2,  # Generation 1: double threshold
            thresholds[2] * 2,  # Generation 2: double threshold
        )

        logger.debug(f"GC thresholds adjusted: {thresholds} -> {gc.get_threshold()}")

    def frame_start(self) -> None:
        """Mark the start of a frame. Call at beginning of render loop."""
        self._frame_start_time = time.time()

    def frame_end(self) -> None:
        """Mark the end of a frame. Call after rendering completes."""
        now = time.time()
        frame_time = now - self._frame_start_time

        # Track frame times
        self._frame_times.append(frame_time)
        self._frame_count += 1

        # Update min/max frame times
        frame_time_ms = frame_time * 1000
        self._min_frame_time = min(self._min_frame_time, frame_time_ms)
        self._max_frame_time = max(self._max_frame_time, frame_time_ms)

        # Check for dropped frames
        time_since_last = now - self._last_frame_end
        if time_since_last > self._target_frame_time * 1.5:
            self._dropped_frames += 1

        self._last_frame_end = now

        # Calculate current FPS
        current_fps = 1.0 / frame_time if frame_time > 0 else 0.0
        self._min_fps = min(self._min_fps, current_fps)
        self._max_fps = max(self._max_fps, current_fps)

        # Memory check
        self._frames_since_memory_check += 1
        if self._frames_since_memory_check >= self.config.memory_check_interval:
            self._check_memory()
            self._frames_since_memory_check = 0

        # Performance alerts
        self._check_alerts(current_fps, frame_time_ms)

        # Periodic logging
        if self.config.log_interval_seconds > 0:
            if now - self._last_log_time >= self.config.log_interval_seconds:
                self._log_performance()
                self._last_log_time = now

    def _get_avg_fps(self) -> float:
        """Calculate rolling average FPS."""
        if not self._frame_times:
            return 0.0
        avg_time = sum(self._frame_times) / len(self._frame_times)
        return 1.0 / avg_time if avg_time > 0 else 0.0

    def _get_avg_frame_time_ms(self) -> float:
        """Calculate rolling average frame time in ms."""
        if not self._frame_times:
            return 0.0
        return (sum(self._frame_times) / len(self._frame_times)) * 1000

    def _check_memory(self) -> None:
        """Check current memory usage."""
        try:
            # Get process memory using /proc on Linux
            memory_mb = self._get_process_memory_mb()
            self._peak_memory = max(self._peak_memory, memory_mb)

            # Update GC collections count
            current_gc = gc.get_count()
            initial = self._initial_gc_counts
            self._gc_collections = sum(current_gc) - sum(initial)

        except Exception as e:
            logger.debug(f"Memory check failed: {e}")

    def _get_process_memory_mb(self) -> float:
        """Get current process memory usage in MB."""
        try:
            # Try using /proc/self/status (Linux)
            with open("/proc/self/status", "r") as f:
                for line in f:
                    if line.startswith("VmRSS:"):
                        # VmRSS is in kB
                        return int(line.split()[1]) / 1024
        except (FileNotFoundError, PermissionError):
            pass

        # Fallback: try psutil if available
        try:
            import psutil

            process = psutil.Process(os.getpid())
            return process.memory_info().rss / (1024 * 1024)
        except ImportError:
            pass

        return 0.0

    def _check_alerts(self, current_fps: float, frame_time_ms: float) -> None:
        """Check for performance issues and trigger alerts."""
        if not self.on_alert:
            return

        # FPS alert
        if current_fps < self.config.fps_alert_threshold:
            self.on_alert(
                "low_fps",
                {"fps": current_fps, "threshold": self.config.fps_alert_threshold},
            )

        # Frame time alert
        if frame_time_ms > self.config.frame_time_alert_ms:
            self.on_alert(
                "slow_frame",
                {"time_ms": frame_time_ms, "threshold": self.config.frame_time_alert_ms},
            )

    def _log_performance(self) -> None:
        """Log current performance metrics."""
        metrics = self.get_metrics()
        logger.info(
            f"Performance: "
            f"FPS={metrics.avg_fps:.1f} (min={metrics.min_fps:.1f}, max={metrics.max_fps:.1f}), "
            f"Memory={metrics.process_memory_mb:.1f}MB (peak={metrics.peak_memory_mb:.1f}MB), "
            f"Textures={metrics.active_textures}, "
            f"Dropped={metrics.dropped_frames}"
        )

    def track_texture_load(self, size_bytes: int = 0) -> None:
        """
        Track a texture being loaded.

        Args:
            size_bytes: Size of the texture in bytes
        """
        self._active_textures += 1
        self._texture_loads += 1
        if size_bytes > 0:
            self._texture_memory += size_bytes / (1024 * 1024)
        logger.debug(f"Texture loaded: total={self._active_textures}")

    def track_texture_unload(self, size_bytes: int = 0) -> None:
        """
        Track a texture being unloaded.

        Args:
            size_bytes: Size of the texture in bytes
        """
        self._active_textures = max(0, self._active_textures - 1)
        self._texture_unloads += 1
        if size_bytes > 0:
            self._texture_memory = max(0, self._texture_memory - size_bytes / (1024 * 1024))
        logger.debug(f"Texture unloaded: total={self._active_textures}")

    def run_gc(self) -> int:
        """
        Run garbage collection manually.

        Should be called during idle periods (between images) to
        avoid GC pauses during transitions.

        Returns:
            Number of unreachable objects collected
        """
        collected = gc.collect()
        logger.debug(f"Manual GC collected {collected} objects")
        return collected

    def get_metrics(self) -> PerformanceMetrics:
        """
        Get current performance metrics.

        Returns:
            PerformanceMetrics with current values
        """
        now = time.time()
        last_frame_time = self._frame_times[-1] if self._frame_times else 0.0

        return PerformanceMetrics(
            current_fps=1.0 / last_frame_time if last_frame_time > 0 else 0.0,
            avg_fps=self._get_avg_fps(),
            min_fps=self._min_fps if self._min_fps != float("inf") else 0.0,
            max_fps=self._max_fps,
            frame_count=self._frame_count,
            last_frame_time_ms=last_frame_time * 1000,
            avg_frame_time_ms=self._get_avg_frame_time_ms(),
            min_frame_time_ms=self._min_frame_time if self._min_frame_time != float("inf") else 0.0,
            max_frame_time_ms=self._max_frame_time,
            process_memory_mb=self._get_process_memory_mb(),
            texture_memory_mb=self._texture_memory,
            peak_memory_mb=self._peak_memory,
            active_textures=self._active_textures,
            texture_loads=self._texture_loads,
            texture_unloads=self._texture_unloads,
            dropped_frames=self._dropped_frames,
            gc_collections=self._gc_collections,
            uptime_seconds=now - self._start_time if self._start_time > 0 else 0.0,
        )

    def reset_stats(self) -> None:
        """Reset performance statistics (keeps running state)."""
        self._frame_times.clear()
        self._frame_count = 0
        self._min_fps = float("inf")
        self._max_fps = 0.0
        self._min_frame_time = float("inf")
        self._max_frame_time = 0.0
        self._dropped_frames = 0
        self._peak_memory = self._get_process_memory_mb()
        logger.debug("Performance stats reset")


def create_performance_monitor(
    target_fps: int = 30,
    log_interval: float = 60.0,
    on_alert: PerformanceAlertCallback | None = None,
) -> PerformanceMonitor:
    """
    Create a performance monitor with common settings.

    Args:
        target_fps: Target frame rate for the application
        log_interval: How often to log performance (seconds, 0=disabled)
        on_alert: Optional callback for performance alerts

    Returns:
        Configured PerformanceMonitor instance
    """
    config = PerformanceConfig(
        target_fps=target_fps,
        log_interval_seconds=log_interval,
    )
    return PerformanceMonitor(config, on_alert)

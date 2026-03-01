"""
Tests for Performance Monitoring in GlowWorm Display Engine.
"""

import gc
import time

import pytest

from glowworm_display.performance import (
    PerformanceConfig,
    PerformanceMetrics,
    PerformanceMonitor,
    create_performance_monitor,
)


class TestPerformanceMetrics:
    """Tests for PerformanceMetrics dataclass."""

    def test_default_values(self):
        """Test default metric values."""
        metrics = PerformanceMetrics()
        assert metrics.current_fps == 0.0
        assert metrics.avg_fps == 0.0
        assert metrics.frame_count == 0
        assert metrics.process_memory_mb == 0.0
        assert metrics.active_textures == 0

    def test_to_dict(self):
        """Test serialization to dictionary."""
        metrics = PerformanceMetrics(
            current_fps=30.0,
            avg_fps=29.5,
            min_fps=25.0,
            max_fps=35.0,
            frame_count=100,
            last_frame_time_ms=33.3,
            process_memory_mb=150.0,
            active_textures=3,
        )

        data = metrics.to_dict()

        assert data["fps"]["current"] == 30.0
        assert data["fps"]["avg"] == 29.5
        assert data["fps"]["min"] == 25.0
        assert data["fps"]["max"] == 35.0
        assert data["memory_mb"]["process"] == 150.0
        assert data["textures"]["active"] == 3
        assert data["health"]["frame_count"] == 100

    def test_inf_values_handled(self):
        """Test that infinity values are handled in serialization."""
        metrics = PerformanceMetrics()
        data = metrics.to_dict()

        # Should convert inf to 0.0
        assert data["fps"]["min"] == 0.0
        assert data["frame_time_ms"]["min"] == 0.0


class TestPerformanceConfig:
    """Tests for PerformanceConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = PerformanceConfig()
        assert config.target_fps == 30
        assert config.fps_window_size == 60
        assert config.memory_check_interval == 30
        assert config.log_interval_seconds == 60.0

    def test_custom_values(self):
        """Test custom configuration."""
        config = PerformanceConfig(
            target_fps=60,
            fps_alert_threshold=50.0,
            memory_alert_threshold_mb=100.0,
        )

        assert config.target_fps == 60
        assert config.fps_alert_threshold == 50.0
        assert config.memory_alert_threshold_mb == 100.0


class TestPerformanceMonitor:
    """Tests for PerformanceMonitor class."""

    def test_initialization(self):
        """Test monitor initialization."""
        monitor = PerformanceMonitor()
        metrics = monitor.get_metrics()

        assert metrics.frame_count == 0
        assert metrics.uptime_seconds == 0.0

    def test_frame_timing(self):
        """Test frame timing tracking."""
        monitor = PerformanceMonitor()
        monitor.start()

        # Simulate a few frames
        for _ in range(5):
            monitor.frame_start()
            time.sleep(0.01)  # 10ms frame
            monitor.frame_end()

        metrics = monitor.get_metrics()

        assert metrics.frame_count == 5
        assert metrics.avg_fps > 0
        assert metrics.avg_frame_time_ms > 0
        assert metrics.avg_frame_time_ms < 50  # Should be around 10ms

        monitor.stop()

    def test_fps_calculation(self):
        """Test FPS calculation accuracy."""
        config = PerformanceConfig(fps_window_size=10)
        monitor = PerformanceMonitor(config)
        monitor.start()

        # Simulate frames at approximately 50 FPS
        for _ in range(10):
            monitor.frame_start()
            time.sleep(0.02)  # 20ms = 50 FPS
            monitor.frame_end()

        metrics = monitor.get_metrics()

        # FPS should be roughly 50 (allowing for timing variance)
        assert 40 < metrics.avg_fps < 60

        monitor.stop()

    def test_texture_tracking(self):
        """Test texture load/unload tracking."""
        monitor = PerformanceMonitor()
        monitor.start()

        # Track some texture operations
        monitor.track_texture_load(1024 * 1024 * 4)  # 4MB
        monitor.track_texture_load(1024 * 1024 * 2)  # 2MB
        monitor.track_texture_unload(1024 * 1024 * 4)

        metrics = monitor.get_metrics()

        assert metrics.active_textures == 1
        assert metrics.texture_loads == 2
        assert metrics.texture_unloads == 1

        monitor.stop()

    def test_dropped_frame_detection(self):
        """Test dropped frame detection."""
        config = PerformanceConfig(target_fps=30)  # 33ms target
        monitor = PerformanceMonitor(config)
        monitor.start()

        # First frame - normal
        monitor.frame_start()
        time.sleep(0.03)  # 30ms
        monitor.frame_end()

        # Second frame - with a "drop" (simulate slow frame)
        time.sleep(0.1)  # Wait longer than target
        monitor.frame_start()
        time.sleep(0.03)
        monitor.frame_end()

        metrics = monitor.get_metrics()

        # Should have detected the dropped frame
        assert metrics.dropped_frames >= 1

        monitor.stop()

    def test_gc_collection(self):
        """Test manual GC triggering."""
        monitor = PerformanceMonitor()
        monitor.start()

        # Create some garbage
        _ = [list(range(1000)) for _ in range(100)]

        collected = monitor.run_gc()

        # Should have collected something (or 0 if nothing to collect)
        assert collected >= 0

        monitor.stop()

    def test_performance_alerts(self):
        """Test performance alert callbacks."""
        alerts_received = []

        def on_alert(alert_type: str, data: dict):
            alerts_received.append((alert_type, data))

        config = PerformanceConfig(
            fps_alert_threshold=100.0,  # High threshold
            frame_time_alert_ms=1.0,  # Very low threshold
        )
        monitor = PerformanceMonitor(config, on_alert=on_alert)
        monitor.start()

        # Trigger alerts with slow frames
        for _ in range(3):
            monitor.frame_start()
            time.sleep(0.02)  # 20ms - will trigger alert
            monitor.frame_end()

        # Should have received some alerts
        assert len(alerts_received) > 0

        monitor.stop()

    def test_uptime_tracking(self):
        """Test uptime tracking."""
        monitor = PerformanceMonitor()
        monitor.start()

        time.sleep(0.1)

        metrics = monitor.get_metrics()

        # Uptime should be at least 0.1 seconds
        assert metrics.uptime_seconds >= 0.09

        monitor.stop()

    def test_reset_stats(self):
        """Test statistics reset."""
        monitor = PerformanceMonitor()
        monitor.start()

        # Generate some stats
        for _ in range(5):
            monitor.frame_start()
            time.sleep(0.01)
            monitor.frame_end()

        assert monitor.get_metrics().frame_count == 5

        # Reset
        monitor.reset_stats()

        assert monitor.get_metrics().frame_count == 0

        monitor.stop()

    def test_create_performance_monitor(self):
        """Test factory function."""
        monitor = create_performance_monitor(
            target_fps=60,
            log_interval=30.0,
        )

        assert monitor.config.target_fps == 60
        assert monitor.config.log_interval_seconds == 30.0


class TestGCOptimization:
    """Tests for GC optimization."""

    def test_gc_threshold_adjustment(self):
        """Test that GC thresholds are adjusted when enabled."""
        original_thresholds = gc.get_threshold()

        config = PerformanceConfig(optimize_gc=True)
        monitor = PerformanceMonitor(config)
        monitor.start()

        # Thresholds should be increased
        new_thresholds = gc.get_threshold()

        # Generation 0 should be at least 3x original
        assert new_thresholds[0] >= original_thresholds[0] * 3

        monitor.stop()

        # Restore original thresholds for other tests
        gc.set_threshold(*original_thresholds)

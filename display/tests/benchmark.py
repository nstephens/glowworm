#!/usr/bin/env python3
"""
Performance benchmark script for GlowWorm Display Engine.

Tests rendering performance including:
- FPS measurements during static display
- FPS measurements during transitions
- Memory usage tracking
- Frame timing statistics

Usage:
    python -m tests.benchmark [--duration SECONDS] [--mock]

When running on Raspberry Pi hardware, omit --mock to test real Pi3D performance.
"""

import argparse
import gc
import os
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path


@dataclass
class BenchmarkResult:
    """Results from a benchmark run."""

    name: str
    duration: float
    frame_count: int
    avg_fps: float
    min_fps: float
    max_fps: float
    avg_frame_time_ms: float
    min_frame_time_ms: float
    max_frame_time_ms: float
    memory_start_mb: float
    memory_end_mb: float
    memory_delta_mb: float

    def __str__(self) -> str:
        return f"""
Benchmark: {self.name}
{'=' * 50}
Duration:       {self.duration:.2f}s
Frame Count:    {self.frame_count}
FPS:            avg={self.avg_fps:.1f}, min={self.min_fps:.1f}, max={self.max_fps:.1f}
Frame Time:     avg={self.avg_frame_time_ms:.2f}ms, min={self.min_frame_time_ms:.2f}ms, max={self.max_frame_time_ms:.2f}ms
Memory:         start={self.memory_start_mb:.1f}MB, end={self.memory_end_mb:.1f}MB, delta={self.memory_delta_mb:+.1f}MB
"""


def get_memory_usage_mb() -> float:
    """Get current process memory usage in MB."""
    try:
        import resource
        rusage = resource.getrusage(resource.RUSAGE_SELF)
        return rusage.ru_maxrss / 1024  # Convert KB to MB on Linux
    except ImportError:
        return 0.0


def create_test_image(path: Path, width: int = 1920, height: int = 1080) -> Path:
    """Create a test image for benchmarking."""
    from PIL import Image
    import random

    # Create an image with random colors for variety
    img = Image.new("RGB", (width, height))
    pixels = img.load()
    for x in range(width):
        for y in range(height):
            pixels[x, y] = (
                random.randint(0, 255),
                random.randint(0, 255),
                random.randint(0, 255),
            )

    img.save(path, "JPEG", quality=85)
    return path


def benchmark_static_display(
    display,
    image_loader,
    test_image: Path,
    duration: float = 5.0,
) -> BenchmarkResult:
    """
    Benchmark static image display.

    Displays a single image and measures frame timing.
    """
    from glowworm_display.image_loader import ScaleMode

    # Force garbage collection before benchmark
    gc.collect()
    memory_start = get_memory_usage_mb()

    # Load test image
    sprite = image_loader.load_image(str(test_image), ScaleMode.FIT)

    frame_times: list[float] = []
    start_time = time.time()
    frame_count = 0

    while time.time() - start_time < duration:
        frame_start = time.time()

        with display.frame():
            sprite.set_alpha(1.0)
            sprite.draw()

        frame_time = time.time() - frame_start
        frame_times.append(frame_time)
        frame_count += 1

    elapsed = time.time() - start_time
    memory_end = get_memory_usage_mb()

    # Calculate statistics
    avg_frame_time = sum(frame_times) / len(frame_times) if frame_times else 0
    min_frame_time = min(frame_times) if frame_times else 0
    max_frame_time = max(frame_times) if frame_times else 0

    avg_fps = frame_count / elapsed if elapsed > 0 else 0
    min_fps = 1.0 / max_frame_time if max_frame_time > 0 else 0
    max_fps = 1.0 / min_frame_time if min_frame_time > 0 else 0

    return BenchmarkResult(
        name="Static Display",
        duration=elapsed,
        frame_count=frame_count,
        avg_fps=avg_fps,
        min_fps=min_fps,
        max_fps=max_fps,
        avg_frame_time_ms=avg_frame_time * 1000,
        min_frame_time_ms=min_frame_time * 1000,
        max_frame_time_ms=max_frame_time * 1000,
        memory_start_mb=memory_start,
        memory_end_mb=memory_end,
        memory_delta_mb=memory_end - memory_start,
    )


def benchmark_transitions(
    display,
    image_loader,
    test_images: list[Path],
    transition_duration: float = 1.0,
    cycles: int = 3,
) -> BenchmarkResult:
    """
    Benchmark cross-fade transitions.

    Runs multiple transition cycles and measures frame timing.
    """
    from glowworm_display.image_loader import ScaleMode
    from glowworm_display.renderer import Renderer

    gc.collect()
    memory_start = get_memory_usage_mb()

    # Create renderer
    renderer = Renderer(
        display=display,
        image_loader=image_loader,
        default_transition_duration=transition_duration,
        mock=display.mock,
    )

    # Queue images for multiple cycles
    for _ in range(cycles):
        for img_path in test_images:
            renderer.queue_image(str(img_path), ScaleMode.FIT)

    frame_times: list[float] = []
    start_time = time.time()

    # Run until all images displayed
    while renderer.run_once():
        frame_time = renderer.stats.last_frame_time
        frame_times.append(frame_time)

        # Check if all images displayed
        if (
            renderer.queue_length == 0
            and renderer.stats.images_displayed >= len(test_images) * cycles
        ):
            # Run a few more frames to ensure completion
            for _ in range(10):
                renderer.run_once()
            break

    elapsed = time.time() - start_time
    memory_end = get_memory_usage_mb()

    # Calculate statistics
    valid_times = [t for t in frame_times if t > 0]
    avg_frame_time = sum(valid_times) / len(valid_times) if valid_times else 0
    min_frame_time = min(valid_times) if valid_times else 0
    max_frame_time = max(valid_times) if valid_times else 0

    avg_fps = renderer.stats.avg_fps
    min_fps = 1.0 / max_frame_time if max_frame_time > 0 else 0
    max_fps = 1.0 / min_frame_time if min_frame_time > 0 else 0

    return BenchmarkResult(
        name=f"Transitions ({cycles} cycles, {transition_duration}s each)",
        duration=elapsed,
        frame_count=renderer.stats.frame_count,
        avg_fps=avg_fps,
        min_fps=min_fps,
        max_fps=max_fps,
        avg_frame_time_ms=avg_frame_time * 1000,
        min_frame_time_ms=min_frame_time * 1000,
        max_frame_time_ms=max_frame_time * 1000,
        memory_start_mb=memory_start,
        memory_end_mb=memory_end,
        memory_delta_mb=memory_end - memory_start,
    )


def benchmark_memory_stability(
    display,
    image_loader,
    test_images: list[Path],
    iterations: int = 50,
) -> BenchmarkResult:
    """
    Benchmark memory stability during extended operation.

    Loads and displays many images sequentially to check for memory leaks.
    """
    from glowworm_display.image_loader import ScaleMode
    from glowworm_display.renderer import Renderer

    gc.collect()
    memory_start = get_memory_usage_mb()

    renderer = Renderer(
        display=display,
        image_loader=image_loader,
        default_transition_duration=0.1,  # Fast transitions for speed
        mock=display.mock,
    )

    # Queue many images
    for i in range(iterations):
        img_path = test_images[i % len(test_images)]
        renderer.queue_image(str(img_path), ScaleMode.FIT)

    frame_times: list[float] = []
    start_time = time.time()

    # Process all images
    while renderer.run_once():
        frame_times.append(renderer.stats.last_frame_time)

        if renderer.queue_length == 0 and renderer.stats.images_displayed >= iterations:
            break

    elapsed = time.time() - start_time

    # Force garbage collection and measure final memory
    gc.collect()
    memory_end = get_memory_usage_mb()

    valid_times = [t for t in frame_times if t > 0]
    avg_frame_time = sum(valid_times) / len(valid_times) if valid_times else 0
    min_frame_time = min(valid_times) if valid_times else 0
    max_frame_time = max(valid_times) if valid_times else 0

    avg_fps = renderer.stats.avg_fps
    min_fps = 1.0 / max_frame_time if max_frame_time > 0 else 0
    max_fps = 1.0 / min_frame_time if min_frame_time > 0 else 0

    return BenchmarkResult(
        name=f"Memory Stability ({iterations} images)",
        duration=elapsed,
        frame_count=renderer.stats.frame_count,
        avg_fps=avg_fps,
        min_fps=min_fps,
        max_fps=max_fps,
        avg_frame_time_ms=avg_frame_time * 1000,
        min_frame_time_ms=min_frame_time * 1000,
        max_frame_time_ms=max_frame_time * 1000,
        memory_start_mb=memory_start,
        memory_end_mb=memory_end,
        memory_delta_mb=memory_end - memory_start,
    )


def run_benchmarks(mock: bool = True, duration: float = 5.0) -> list[BenchmarkResult]:
    """Run all benchmarks and return results."""
    from glowworm_display.config import DisplayConfig, Rotation
    from glowworm_display.display import Display
    from glowworm_display.image_loader import ImageLoader

    results: list[BenchmarkResult] = []

    # Create temporary directory for test images
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        # Create test images
        print("Creating test images...")
        test_images = []
        for i in range(5):
            img_path = temp_path / f"test_{i}.jpg"
            create_test_image(img_path)
            test_images.append(img_path)

        # Initialize display
        print(f"Initializing display (mock={mock})...")
        config = DisplayConfig(
            width=1920,
            height=1080,
            fps_target=60,
        )
        display = Display(config=config, mock=mock)
        display.initialize()

        image_loader = ImageLoader(
            display_width=display.width,
            display_height=display.height,
            rotation=Rotation.DEG_0,
            mock=mock,
        )

        try:
            # Run benchmarks
            print("\nRunning benchmarks...")
            print("-" * 50)

            # 1. Static display benchmark
            print("Benchmark 1: Static Display")
            result = benchmark_static_display(
                display, image_loader, test_images[0], duration=duration
            )
            results.append(result)
            print(result)

            # 2. Transitions benchmark
            print("Benchmark 2: Transitions")
            result = benchmark_transitions(
                display, image_loader, test_images, transition_duration=0.5, cycles=3
            )
            results.append(result)
            print(result)

            # 3. Memory stability benchmark
            print("Benchmark 3: Memory Stability")
            result = benchmark_memory_stability(
                display, image_loader, test_images, iterations=30
            )
            results.append(result)
            print(result)

        finally:
            display.cleanup()

    return results


def print_summary(results: list[BenchmarkResult], mock: bool) -> None:
    """Print benchmark summary with pass/fail status."""
    print("\n" + "=" * 60)
    print("BENCHMARK SUMMARY")
    print("=" * 60)
    print(f"Mode: {'MOCK' if mock else 'HARDWARE'}")
    print()

    # Performance targets (for hardware mode)
    TARGET_FPS = 30.0 if not mock else 100.0  # Mock mode should be faster
    TARGET_MEMORY_DELTA = 50.0  # MB

    all_passed = True

    for result in results:
        fps_ok = result.avg_fps >= TARGET_FPS
        memory_ok = result.memory_delta_mb <= TARGET_MEMORY_DELTA

        status = "PASS" if (fps_ok and memory_ok) else "FAIL"
        if status == "FAIL":
            all_passed = False

        print(f"{result.name}:")
        print(f"  FPS:    {result.avg_fps:.1f} (target: {TARGET_FPS}+) {'OK' if fps_ok else 'FAIL'}")
        print(f"  Memory: {result.memory_delta_mb:+.1f}MB (target: <{TARGET_MEMORY_DELTA}MB) {'OK' if memory_ok else 'FAIL'}")
        print(f"  Status: {status}")
        print()

    print("=" * 60)
    print(f"OVERALL: {'ALL BENCHMARKS PASSED' if all_passed else 'SOME BENCHMARKS FAILED'}")
    print("=" * 60)


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="GlowWorm Display Engine Performance Benchmark",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m tests.benchmark --mock         # Run with mocked Pi3D
  python -m tests.benchmark                # Run with real Pi3D (on Raspberry Pi)
  python -m tests.benchmark --duration 10  # Run longer benchmarks
""",
    )
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Run in mock mode without actual Pi3D display",
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=5.0,
        help="Duration for each benchmark in seconds (default: 5.0)",
    )
    args = parser.parse_args()

    print("GlowWorm Display Engine - Performance Benchmark")
    print("=" * 50)
    print()

    try:
        results = run_benchmarks(mock=args.mock, duration=args.duration)
        print_summary(results, mock=args.mock)

        # Return non-zero if any benchmark failed
        TARGET_FPS = 30.0 if not args.mock else 100.0
        for result in results:
            if result.avg_fps < TARGET_FPS:
                return 1
            if result.memory_delta_mb > 50.0:
                return 1

        return 0

    except KeyboardInterrupt:
        print("\nBenchmark interrupted by user")
        return 1
    except Exception as e:
        print(f"\nBenchmark failed with error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())

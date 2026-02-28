"""
GlowWorm Display Engine - Main Entry Point

Launches the Pi3D display engine with IPC server for daemon communication.
"""

import argparse
import logging
import sys
import time
from pathlib import Path

from glowworm_display.config import DisplayConfig, load_config
from glowworm_display.display import Display
from glowworm_display.image_loader import ImageLoader, ImageLoadError, ScaleMode

logger = logging.getLogger(__name__)


def setup_logging(level: str = "INFO", log_file: str | None = None) -> None:
    """Configure logging for the display engine."""
    log_level = getattr(logging, level.upper(), logging.INFO)

    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]

    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_file))

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=handlers,
    )


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        prog="glowworm-display",
        description="GlowWorm Pi3D Display Engine",
    )
    parser.add_argument(
        "-c",
        "--config",
        type=str,
        default=None,
        help="Path to configuration file (YAML)",
    )
    parser.add_argument(
        "--socket",
        type=str,
        default="/run/glowworm/display.sock",
        help="IPC socket path (default: /run/glowworm/display.sock)",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default="INFO",
        help="Logging level (default: INFO)",
    )
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Run in mock mode without actual Pi3D display (for development)",
    )
    parser.add_argument(
        "--test-frames",
        type=int,
        default=0,
        help="Run for N frames then exit (for testing, 0=run forever)",
    )
    parser.add_argument(
        "--test-image",
        type=str,
        default=None,
        help="Display a test image (requires --test-frames or --mock)",
    )
    parser.add_argument(
        "--scale-mode",
        type=str,
        choices=["fit", "fill", "stretch"],
        default="fit",
        help="Image scaling mode (default: fit)",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {__import__('glowworm_display').__version__}",
    )
    return parser.parse_args()


def main() -> int:
    """Main entry point for the display engine."""
    args = parse_args()

    # Setup logging
    setup_logging(level=args.log_level)

    logger.info("GlowWorm Display Engine starting...")

    # Load configuration
    try:
        if args.config:
            config = load_config(args.config)
        else:
            config = DisplayConfig()
        logger.info(f"Configuration loaded: orientation={config.orientation}")
    except Exception as e:
        logger.error(f"Failed to load configuration: {e}")
        return 1

    # Override socket path if provided
    socket_path = args.socket

    logger.info(f"IPC socket: {socket_path}")
    logger.info(f"Mock mode: {args.mock}")

    # Initialize Pi3D display
    display = Display(config=config, mock=args.mock)

    try:
        display.initialize()
        logger.info(f"Display initialized: {display.width}x{display.height}")
    except RuntimeError as e:
        logger.error(f"Failed to initialize display: {e}")
        return 1

    logger.info("Display engine initialized successfully")
    logger.info("Ready to receive commands via IPC")

    # Create image loader
    image_loader = ImageLoader(
        display_width=display.width,
        display_height=display.height,
        rotation=config.rotation,
        mock=args.mock,
    )

    # Load test image if specified
    test_sprite = None
    if args.test_image:
        scale_mode = ScaleMode(args.scale_mode)
        try:
            test_sprite = image_loader.load_image(args.test_image, scale_mode=scale_mode)
            logger.info(f"Test image loaded: {args.test_image}")
        except ImageLoadError as e:
            logger.error(f"Failed to load test image: {e}")
            display.cleanup()
            return 1

    # Run test frames if requested (for testing)
    if args.test_frames > 0:
        logger.info(f"Running {args.test_frames} test frames...")
        frame_count = 0
        start_time = time.time()

        while frame_count < args.test_frames and display.is_running:
            with display.frame():
                if test_sprite:
                    test_sprite.draw()
            frame_count += 1

        elapsed = time.time() - start_time
        fps = frame_count / elapsed if elapsed > 0 else 0
        logger.info(f"Completed {frame_count} frames in {elapsed:.2f}s ({fps:.1f} FPS)")
        display.cleanup()
        return 0

    # For mock mode without test frames, just verify init works
    if args.mock and not args.test_image:
        logger.info("Mock mode - display initialized successfully, exiting")
        display.cleanup()
        return 0

    # If mock mode with test image but no test frames, run a short demo
    if args.mock and args.test_image and args.test_frames == 0:
        logger.info("Mock mode with test image - running 60 demo frames")
        frame_count = 0
        while frame_count < 60 and display.is_running:
            with display.frame():
                if test_sprite:
                    test_sprite.draw()
            frame_count += 1
        display.cleanup()
        return 0

    # TODO: Start IPC server (Task 1.6)
    # TODO: Enter main render loop (Task 1.5)

    # Placeholder for main loop - run until stopped
    logger.info("Entering main render loop (placeholder)...")
    try:
        while display.is_running:
            with display.frame():
                # Nothing to draw yet - just background color
                pass
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    finally:
        display.cleanup()

    return 0


if __name__ == "__main__":
    sys.exit(main())

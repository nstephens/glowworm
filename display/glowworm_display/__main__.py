"""
GlowWorm Display Engine - Main Entry Point

Launches the Pi3D display engine with IPC server for daemon communication.
"""

import argparse
import logging
import sys
from pathlib import Path

from glowworm_display.config import DisplayConfig, load_config

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

    # TODO: Initialize Pi3D display (Task 1.2)
    # TODO: Start IPC server (Task 1.6)
    # TODO: Enter main render loop (Task 1.5)

    logger.info("Display engine initialized successfully")
    logger.info("Ready to receive commands via IPC")

    # For now, just confirm startup works
    if args.mock:
        logger.info("Mock mode - exiting after initialization check")
        return 0

    # Placeholder for main loop
    logger.warning("Main render loop not yet implemented - exiting")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""
Main entry point for Glowworm daemon service
"""
import sys
import signal
import logging
from .daemon import GlowwormDaemon
from .config import load_config

logger = logging.getLogger(__name__)


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    logger.info(f"Received signal {signum}, shutting down...")
    sys.exit(0)


def main():
    """Main entry point for the daemon"""
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Load configuration
        config = load_config()
        
        # Create and start daemon
        daemon = GlowwormDaemon(config)
        logger.info("Starting Glowworm daemon...")
        daemon.run()
        
    except Exception as e:
        logger.error(f"Fatal error in daemon: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()


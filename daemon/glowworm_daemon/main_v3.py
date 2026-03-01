"""
GlowWorm v3.0 Daemon Entry Point

This is the Pi3D-based daemon that:
- Manages the Pi3D display subprocess
- Handles device registration if no token
- Communicates with backend via WebSocket
- Orchestrates slideshow playback
"""
import asyncio
import signal
import logging
import sys
from pathlib import Path

from .unified_config import load_config, UnifiedConfig
from .display_controller import DisplayController, DisplayControllerConfig
from .registration_manager import RegistrationManager, RegistrationConfig, RegistrationState
from .websocket_client import WebSocketClient, WebSocketConfig, ConnectionState
from .status_reporter import StatusReporter, StatusReporterConfig
from .command_handler import CommandHandler, CommandHandlerConfig
from .slideshow_orchestrator import SlideshowOrchestrator, SlideshowConfig
from .playlist_manager import PlaylistManager
from .image_manager import ImageManager
from .cache import create_cache, CacheConfig
from .logging_config import setup_logging

logger = logging.getLogger(__name__)

VERSION = "3.0.0"


class GlowwormDaemonV3:
    """Main v3 daemon orchestrating all components."""

    def __init__(self, config: UnifiedConfig):
        self.config = config
        self.running = False
        self._shutdown_event = asyncio.Event()

        # Core components (initialized in start)
        self.display: DisplayController | None = None
        self.websocket: WebSocketClient | None = None
        self.slideshow: SlideshowOrchestrator | None = None
        self.status_reporter: StatusReporter | None = None
        self.command_handler: CommandHandler | None = None
        self.playlist_manager: PlaylistManager | None = None
        self.image_manager: ImageManager | None = None
        self.cache = None

    async def start(self):
        """Start the daemon and all components."""
        logger.info("=" * 60)
        logger.info(f"GlowWorm Display Daemon v{VERSION}")
        logger.info("=" * 60)
        logger.info(f"Backend URL: {self.config.backend.url}")
        logger.info(f"Config file: {self.config._source_file if hasattr(self.config, '_source_file') else 'default'}")

        self.running = True

        # Initialize cache
        cache_config = CacheConfig(
            cache_dir=self.config.cache.directory,
            max_size_mb=self.config.cache.max_size_mb,
            min_free_space_mb=self.config.cache.min_free_space_mb,
        )
        self.cache = create_cache(cache_config)

        # Initialize display controller
        display_config = DisplayControllerConfig.from_unified_config(self.config)
        self.display = DisplayController(display_config)

        # Check if we need registration
        if not self.config.backend.device_token:
            logger.info("No device token configured - entering registration mode")
            success = await self._run_registration()
            if not success:
                logger.error("Registration failed or was cancelled")
                return
            # Reload config to get the saved token
            self.config = load_config()

        # Start display
        logger.info("Starting Pi3D display...")
        await self.display.start()

        # Wait for display to be ready
        for _ in range(30):
            if self.display.is_running:
                break
            await asyncio.sleep(0.5)
        else:
            logger.error("Display failed to start within timeout")
            return

        logger.info("Display started successfully")

        # Initialize managers
        self.image_manager = ImageManager(
            backend_url=self.config.backend.url,
            cache=self.cache,
        )

        self.playlist_manager = PlaylistManager(
            backend_url=self.config.backend.url,
            device_token=self.config.backend.device_token,
        )

        # Initialize slideshow orchestrator
        slideshow_config = SlideshowConfig(
            display_time=self.config.slideshow.display_time,
            transition_duration=self.config.slideshow.transition_duration,
            preload_count=self.config.slideshow.preload_count,
        )
        self.slideshow = SlideshowOrchestrator(
            display=self.display,
            playlist=self.playlist_manager,
            images=self.image_manager,
            config=slideshow_config,
        )

        # Initialize WebSocket client
        ws_url = self.config.backend.effective_websocket_url
        ws_config = WebSocketConfig(
            url=ws_url,
            device_token=self.config.backend.device_token,
            auto_reconnect=True,
            heartbeat_interval=30.0,
        )
        self.websocket = WebSocketClient(
            config=ws_config,
            message_handler=self._on_websocket_message,
            state_callback=self._on_websocket_state,
        )

        # Initialize status reporter
        status_config = StatusReporterConfig(
            report_interval=30.0,
            report_on_state_change=True,
        )
        self.status_reporter = StatusReporter(
            websocket=self.websocket,
            slideshow=self.slideshow,
            display=self.display,
            cache=self.cache,
            config=status_config,
        )

        # Initialize command handler
        cmd_config = CommandHandlerConfig(
            send_acknowledgment=True,
        )
        self.command_handler = CommandHandler(
            websocket=self.websocket,
            slideshow=self.slideshow,
            playlist=self.playlist_manager,
            config=cmd_config,
        )

        # Start WebSocket connection
        logger.info(f"Connecting to WebSocket: {ws_url}")
        await self.websocket.connect()

        # Load playlist and start slideshow
        logger.info("Loading playlist...")
        try:
            await self.playlist_manager.load_playlist()
            logger.info(f"Playlist loaded: {len(self.playlist_manager.entries)} entries")
        except Exception as e:
            logger.warning(f"Failed to load playlist: {e}")

        # Start slideshow
        logger.info("Starting slideshow...")
        await self.slideshow.start()

        # Start status reporter
        await self.status_reporter.start()

        logger.info("Daemon fully initialized and running")

        # Main loop - wait for shutdown
        await self._shutdown_event.wait()

    async def _run_registration(self) -> bool:
        """Run the device registration flow."""
        logger.info("Starting registration flow...")

        # Start display for registration screen
        display_config = DisplayControllerConfig.from_unified_config(self.config)
        self.display = DisplayController(display_config)
        await self.display.start()

        # Wait for display
        for _ in range(30):
            if self.display.is_running:
                break
            await asyncio.sleep(0.5)
        else:
            logger.error("Display failed to start for registration")
            return False

        # Create registration manager
        reg_config = RegistrationConfig(
            backend_url=self.config.backend.url,
            config_file=Path("/etc/glowworm/config.yaml"),
            poll_interval=5.0,
            authorization_timeout=600.0,  # 10 minutes
        )

        def on_state_change(old_state: RegistrationState, new_state: RegistrationState):
            logger.info(f"Registration state: {old_state.value} -> {new_state.value}")

        registration = RegistrationManager(
            config=reg_config,
            state_callback=on_state_change,
        )

        # Run registration
        result = await registration.run_registration(self.display)

        if result.success:
            logger.info(f"Registration successful! Device ID: {result.device_id}")
            return True
        else:
            logger.error(f"Registration failed: {result.error}")
            return False

    def _on_websocket_message(self, msg_type: str, payload: dict):
        """Handle incoming WebSocket messages."""
        logger.debug(f"WebSocket message: {msg_type}")
        if msg_type == "command" and self.command_handler:
            asyncio.create_task(self.command_handler.handle_message(msg_type, payload))
        elif msg_type == "playlist_update":
            logger.info("Received playlist update notification")
            if self.playlist_manager:
                asyncio.create_task(self.playlist_manager.load_playlist())

    def _on_websocket_state(self, old_state: ConnectionState, new_state: ConnectionState):
        """Handle WebSocket state changes."""
        logger.info(f"WebSocket state: {old_state.value} -> {new_state.value}")

    async def stop(self):
        """Stop the daemon gracefully."""
        logger.info("Stopping daemon...")
        self.running = False
        self._shutdown_event.set()

        # Stop components in reverse order
        if self.status_reporter:
            await self.status_reporter.stop()

        if self.slideshow:
            await self.slideshow.stop()

        if self.websocket:
            await self.websocket.disconnect()

        if self.display:
            await self.display.stop()

        logger.info("Daemon stopped")


async def async_main():
    """Async main entry point."""
    # Load configuration
    try:
        config = load_config()
    except Exception as e:
        print(f"Failed to load configuration: {e}", file=sys.stderr)
        sys.exit(1)

    # Setup logging
    setup_logging(
        log_level=config.logging.level,
        log_file=config.logging.file,
        use_systemd=True,
    )

    # Create daemon
    daemon = GlowwormDaemonV3(config)

    # Setup signal handlers
    loop = asyncio.get_event_loop()

    def signal_handler():
        logger.info("Received shutdown signal")
        asyncio.create_task(daemon.stop())

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, signal_handler)

    # Run daemon
    try:
        await daemon.start()
    except Exception as e:
        logger.error(f"Daemon error: {e}", exc_info=True)
        sys.exit(1)


def main():
    """Main entry point."""
    asyncio.run(async_main())


if __name__ == "__main__":
    main()

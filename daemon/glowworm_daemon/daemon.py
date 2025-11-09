"""
Main daemon service class for Glowworm display device
Handles initialization, lifecycle, and command polling
"""
import time
import logging
import requests
from typing import Optional, Dict, Any, List
from datetime import datetime

from .config import DaemonConfig
from .logging_config import setup_logging

logger = logging.getLogger(__name__)


class GlowwormDaemon:
    """Main daemon service class"""
    
    DAEMON_VERSION = "1.0.0"
    
    def __init__(self, config: DaemonConfig):
        """
        Initialize the daemon
        
        Args:
            config: Configuration object
        """
        self.config = config
        self.running = False
        self.registered = False
        self.device_id = None
        self.last_poll_time = None
        self.consecutive_errors = 0
        self.max_consecutive_errors = 10
        self.registration_retry_count = 0
        self.max_registration_retries = 5
        
        # Setup logging
        setup_logging(
            log_level=config.log_level,
            log_file=config.log_file,
            use_systemd=True,
        )
        
        logger.info("=" * 60)
        logger.info(f"Glowworm Display Device Daemon v{self.DAEMON_VERSION}")
        logger.info("=" * 60)
        logger.info(f"Backend URL: {config.backend_url}")
        logger.info(f"Device Token: {config.device_token[:4]}****")
        logger.info(f"Poll Interval: {config.poll_interval}s")
        logger.info(f"CEC Enabled: {config.cec_enabled}")
        logger.info(f"Log Level: {config.log_level}")
    
    def run(self) -> None:
        """Main daemon loop"""
        self.running = True
        logger.info("Daemon started successfully")
        
        try:
            # Validate connectivity on startup
            if not self._check_backend_connectivity():
                logger.error("Failed to connect to backend, entering retry mode...")
            
            # Register with backend
            if not self._register_with_backend():
                logger.error("Failed to register with backend after retries")
                logger.error("Continuing with polling anyway...")
            
            # Main polling loop
            while self.running:
                try:
                    self._poll_and_execute_commands()
                    
                    # Reset error counter on success
                    if self.consecutive_errors > 0:
                        logger.info("Connection restored, resetting error counter")
                        self.consecutive_errors = 0
                    
                except Exception as e:
                    self._handle_polling_error(e)
                
                # Sleep until next poll
                self._sleep_until_next_poll()
        
        except KeyboardInterrupt:
            logger.info("Received interrupt signal")
        
        finally:
            self.stop()
    
    def stop(self) -> None:
        """Stop the daemon gracefully"""
        logger.info("Stopping daemon...")
        self.running = False
        logger.info("Daemon stopped")
    
    def _check_backend_connectivity(self) -> bool:
        """
        Check if backend is reachable
        
        Returns:
            True if backend is accessible, False otherwise
        """
        try:
            logger.info("Testing backend connectivity...")
            
            # Try to reach the backend health endpoint
            url = f"{self.config.backend_url}/health"
            response = requests.get(
                url,
                timeout=5,
                headers={"User-Agent": f"Glowworm-Daemon/{self.DAEMON_VERSION}"}
            )
            
            if response.status_code == 200:
                logger.info("✓ Backend connectivity OK")
                return True
            else:
                logger.warning(f"Backend returned status {response.status_code}")
                return False
        
        except requests.exceptions.ConnectionError:
            logger.error(f"Cannot reach backend at {self.config.backend_url}")
            return False
        
        except Exception as e:
            logger.error(f"Connectivity check failed: {e}")
            return False
    
    def _register_with_backend(self) -> bool:
        """
        Register daemon with backend
        
        Returns:
            True if registration successful, False otherwise
        """
        while self.registration_retry_count < self.max_registration_retries:
            try:
                logger.info(
                    f"Registering with backend (attempt {self.registration_retry_count + 1}/"
                    f"{self.max_registration_retries})..."
                )
                
                # Detect capabilities
                capabilities = {
                    "url_update": True,
                    "cec_control": self.config.cec_enabled,
                }
                
                # Prepare registration payload
                payload = {
                    "daemon_version": self.DAEMON_VERSION,
                    "capabilities": capabilities,
                }
                
                # Send registration request
                url = f"{self.config.backend_url}/api/device-daemon/register"
                response = requests.post(
                    url,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self.config.device_token}",
                        "User-Agent": f"Glowworm-Daemon/{self.DAEMON_VERSION}",
                    },
                    timeout=10,
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self.registered = True
                    logger.info("✓ Successfully registered with backend")
                    logger.info(f"  Recommended poll interval: {data.get('poll_interval', 30)}s")
                    logger.info(f"  Capabilities: {list(capabilities.keys())}")
                    return True
                
                elif response.status_code == 401:
                    logger.error("✗ Authentication failed - invalid device token")
                    logger.error("  Please check your daemon.conf configuration")
                    return False
                
                elif response.status_code == 403:
                    logger.error("✗ Device not authorized")
                    logger.error("  Please authorize this device in the admin UI")
                    return False
                
                else:
                    logger.warning(f"Registration returned status {response.status_code}")
                    self.registration_retry_count += 1
                    if self.registration_retry_count < self.max_registration_retries:
                        retry_delay = min(2 ** self.registration_retry_count, 30)
                        logger.info(f"Retrying in {retry_delay}s...")
                        time.sleep(retry_delay)
            
            except requests.exceptions.Timeout:
                logger.warning("Registration request timed out")
                self.registration_retry_count += 1
                if self.registration_retry_count < self.max_registration_retries:
                    time.sleep(5)
            
            except requests.exceptions.ConnectionError:
                logger.warning("Connection error during registration")
                self.registration_retry_count += 1
                if self.registration_retry_count < self.max_registration_retries:
                    time.sleep(5)
            
            except Exception as e:
                logger.error(f"Registration error: {e}", exc_info=True)
                self.registration_retry_count += 1
                if self.registration_retry_count < self.max_registration_retries:
                    time.sleep(5)
        
        logger.error(f"Failed to register after {self.max_registration_retries} attempts")
        return False
    
    def _poll_and_execute_commands(self) -> None:
        """Poll for commands and execute them"""
        self.last_poll_time = datetime.now()
        
        # Get pending commands from backend
        commands = self._fetch_pending_commands()
        
        if not commands:
            logger.debug("No pending commands")
            return
        
        logger.info(f"Received {len(commands)} command(s) to execute")
        
        # Execute each command
        for command in commands:
            self._execute_command(command)
    
    def _fetch_pending_commands(self) -> List[Dict[str, Any]]:
        """
        Fetch pending commands from backend
        
        Returns:
            List of command dictionaries
        """
        try:
            url = f"{self.config.backend_url}/api/device-daemon/commands/poll"
            
            response = requests.get(
                url,
                headers={
                    "Authorization": f"Bearer {self.config.device_token}",
                    "User-Agent": "Glowworm-Daemon/1.0.0",
                },
                timeout=10,
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get("commands", [])
            
            elif response.status_code == 401:
                logger.error("Authentication failed - invalid device token")
                return []
            
            elif response.status_code == 404:
                logger.debug("No daemon endpoint available (feature not yet implemented)")
                return []
            
            else:
                logger.warning(f"Unexpected response status: {response.status_code}")
                return []
        
        except requests.exceptions.Timeout:
            logger.warning("Request timeout while fetching commands")
            return []
        
        except requests.exceptions.ConnectionError:
            logger.warning("Connection error while fetching commands")
            return []
        
        except Exception as e:
            logger.error(f"Error fetching commands: {e}", exc_info=True)
            return []
    
    def _execute_command(self, command: Dict[str, Any]) -> None:
        """
        Execute a command and report result
        
        Args:
            command: Command dictionary with id, type, and parameters
        """
        command_id = command.get("id")
        command_type = command.get("type")
        parameters = command.get("parameters", {})
        
        logger.info(f"Executing command #{command_id}: {command_type}")
        logger.debug(f"Command parameters: {parameters}")
        
        try:
            result = self._dispatch_command(command_type, parameters)
            self._report_command_result(command_id, "completed", result)
            logger.info(f"Command #{command_id} completed successfully")
        
        except Exception as e:
            error_message = str(e)
            logger.error(f"Command #{command_id} failed: {error_message}", exc_info=True)
            self._report_command_result(command_id, "failed", {"error": error_message})
    
    def _dispatch_command(self, command_type: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Dispatch command to appropriate handler
        
        Args:
            command_type: Type of command (url_update, cec_power, etc.)
            parameters: Command parameters
        
        Returns:
            Command result dictionary
        
        Raises:
            NotImplementedError: If command type is not supported
        """
        # Placeholder for command handlers (will be implemented in later tasks)
        logger.debug(f"Command dispatch: {command_type}")
        
        if command_type == "url_update":
            return {"status": "not_implemented", "message": "URL update feature pending"}
        
        elif command_type == "cec_power_on":
            return {"status": "not_implemented", "message": "CEC power on pending"}
        
        elif command_type == "cec_power_off":
            return {"status": "not_implemented", "message": "CEC power off pending"}
        
        elif command_type == "cec_set_input":
            return {"status": "not_implemented", "message": "CEC set input pending"}
        
        elif command_type == "cec_scan_inputs":
            return {"status": "not_implemented", "message": "CEC scan inputs pending"}
        
        elif command_type == "test":
            # Test command for development
            return {"status": "success", "message": "Test command executed"}
        
        else:
            raise NotImplementedError(f"Unknown command type: {command_type}")
    
    def _report_command_result(
        self, 
        command_id: int, 
        status: str, 
        result: Dict[str, Any]
    ) -> None:
        """
        Report command execution result to backend
        
        Args:
            command_id: Command ID
            status: Execution status (completed, failed)
            result: Result data dictionary
        """
        try:
            url = f"{self.config.backend_url}/api/device-daemon/commands/{command_id}/result"
            
            payload = {
                "status": status,
                "result": result,
                "completed_at": datetime.now().isoformat(),
            }
            
            response = requests.post(
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.config.device_token}",
                    "User-Agent": "Glowworm-Daemon/1.0.0",
                },
                timeout=10,
            )
            
            if response.status_code in [200, 201]:
                logger.debug(f"Command #{command_id} result reported successfully")
            else:
                logger.warning(
                    f"Failed to report command result: status {response.status_code}"
                )
        
        except Exception as e:
            logger.error(f"Error reporting command result: {e}")
    
    def _handle_polling_error(self, error: Exception) -> None:
        """
        Handle errors during polling
        
        Args:
            error: Exception that occurred
        """
        self.consecutive_errors += 1
        logger.error(
            f"Polling error #{self.consecutive_errors}: {error}",
            exc_info=True
        )
        
        if self.consecutive_errors >= self.max_consecutive_errors:
            logger.critical(
                f"Too many consecutive errors ({self.consecutive_errors}), "
                "stopping daemon"
            )
            self.stop()
    
    def _sleep_until_next_poll(self) -> None:
        """Sleep until next poll interval"""
        time.sleep(self.config.poll_interval)
    
    @property
    def uptime(self) -> Optional[float]:
        """
        Get daemon uptime in seconds
        
        Returns:
            Uptime in seconds, or None if not running
        """
        if self.last_poll_time:
            return (datetime.now() - self.last_poll_time).total_seconds()
        return None


if __name__ == "__main__":
    # Test daemon initialization
    from .config import load_config
    
    print("Testing daemon initialization...")
    
    # Create test config
    import configparser
    import tempfile
    
    config_data = """
[daemon]
backend_url = http://localhost:8002
device_token = test-token-123
poll_interval = 30
log_level = DEBUG

[cec]
enabled = false

[fullpageos]
config_path = /boot/firmware/fullpageos.txt
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.conf', delete=False) as f:
        f.write(config_data)
        config_file = f.name
    
    try:
        config = load_config(config_file)
        daemon = GlowwormDaemon(config)
        print(f"\n✓ Daemon initialized successfully")
        print(f"  Backend: {daemon.config.backend_url}")
        print(f"  Poll interval: {daemon.config.poll_interval}s")
        print(f"  CEC enabled: {daemon.config.cec_enabled}")
    finally:
        import os
        os.unlink(config_file)


"""
Command Executor Factory and Base Classes
Handles execution of commands received from the backend
"""
import os
import re
import shutil
import logging
from typing import Dict, Any, Optional
from abc import ABC, abstractmethod
from urllib.parse import urlparse
from datetime import datetime

from .cec_controller import CECController

logger = logging.getLogger(__name__)


class CommandExecutor(ABC):
    """Base class for command executors"""
    
    def __init__(self, config):
        """
        Initialize executor
        
        Args:
            config: Daemon configuration object
        """
        self.config = config
    
    @abstractmethod
    def execute(self, command_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the command
        
        Args:
            command_data: Command parameters
        
        Returns:
            Dict with execution result
        
        Raises:
            Exception: If command execution fails
        """
        pass
    
    @abstractmethod
    def validate(self, command_data: Dict[str, Any]) -> bool:
        """
        Validate command data before execution
        
        Args:
            command_data: Command parameters
        
        Returns:
            True if valid, False otherwise
        """
        pass


class TestCommandExecutor(CommandExecutor):
    """Test command executor for development"""
    
    def validate(self, command_data: Dict[str, Any]) -> bool:
        return True
    
    def execute(self, command_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute test command"""
        logger.info("Executing test command")
        
        message = command_data.get("message", "Test command executed")
        
        return {
            "status": "success",
            "message": message,
            "test_mode": True,
        }


class URLUpdateExecutor(CommandExecutor):
    """Executor for browser URL updates"""
    
    def validate(self, command_data: Dict[str, Any]) -> bool:
        """Validate URL update command"""
        if "url" not in command_data:
            logger.error("URL update command missing 'url' parameter")
            return False
        
        url = command_data["url"]
        
        # Validate URL format
        try:
            parsed = urlparse(url)
            if not all([parsed.scheme, parsed.netloc]):
                logger.error(f"Invalid URL format: {url}")
                return False
            
            # Check scheme is http or https
            if parsed.scheme not in ['http', 'https']:
                logger.error(f"URL must use http or https: {url}")
                return False
            
            logger.debug(f"URL validation passed: {url}")
            return True
        
        except Exception as e:
            logger.error(f"URL validation error: {e}")
            return False
    
    def execute(self, command_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute URL update command
        
        Updates the FullPageOS configuration file with new browser URL
        """
        url = command_data["url"]
        config_path = self.config.fullpageos_config_path
        backup_enabled = self.config.fullpageos_backup_enabled
        
        logger.info(f"Updating browser URL to: {url}")
        logger.info(f"Config path: {config_path}")
        
        try:
            # Check if config file exists
            if not os.path.exists(config_path):
                logger.warning(f"Config file not found: {config_path}")
                return {
                    "status": "failed",
                    "error": f"Config file not found: {config_path}",
                    "url": url,
                }
            
            # Create backup if enabled
            if backup_enabled:
                backup_path = f"{config_path}.bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                try:
                    shutil.copy2(config_path, backup_path)
                    logger.info(f"Created backup: {backup_path}")
                except Exception as e:
                    logger.warning(f"Failed to create backup: {e}")
                    # Continue anyway - backup failure shouldn't stop update
            
            # Read current config
            try:
                with open(config_path, 'r') as f:
                    content = f.read()
            except PermissionError:
                logger.error(f"Permission denied reading config: {config_path}")
                return {
                    "status": "failed",
                    "error": "Permission denied - daemon may need root privileges",
                    "url": url,
                }
            except Exception as e:
                logger.error(f"Error reading config: {e}")
                return {
                    "status": "failed",
                    "error": f"Failed to read config: {str(e)}",
                    "url": url,
                }
            
            # Update kiosk_url line
            if 'kiosk_url=' in content:
                # Replace existing kiosk_url line
                new_content = re.sub(
                    r'kiosk_url=.*',
                    f'kiosk_url={url}',
                    content
                )
                logger.debug("Updated existing kiosk_url line")
            else:
                # Add kiosk_url line if it doesn't exist
                new_content = content.rstrip() + f'\nkiosk_url={url}\n'
                logger.debug("Added new kiosk_url line")
            
            # Write updated config
            try:
                with open(config_path, 'w') as f:
                    f.write(new_content)
                logger.info("Config file updated successfully")
            except PermissionError:
                logger.error(f"Permission denied writing config: {config_path}")
                return {
                    "status": "failed",
                    "error": "Permission denied - daemon may need root privileges",
                    "url": url,
                }
            except Exception as e:
                logger.error(f"Error writing config: {e}")
                return {
                    "status": "failed",
                    "error": f"Failed to write config: {str(e)}",
                    "url": url,
                }
            
            # Reload browser
            reload_result = self._reload_browser()
            
            return {
                "status": "success",
                "url": url,
                "config_path": config_path,
                "backup_created": backup_enabled,
                "browser_reloaded": reload_result["success"],
                "reload_method": reload_result["method"],
            }
        
        except Exception as e:
            logger.error(f"Unexpected error during URL update: {e}", exc_info=True)
            return {
                "status": "failed",
                "error": f"Unexpected error: {str(e)}",
                "url": url,
            }
    
    def _reload_browser(self) -> Dict[str, Any]:
        """
        Reload the browser to apply new URL
        
        Returns:
            Dict with success status and method used
        """
        logger.info("Attempting to reload browser")
        
        # Try method 1: Restart FullPageOS service
        try:
            result = os.system('sudo systemctl restart fullpageos 2>/dev/null')
            if result == 0:
                logger.info("✓ Browser reloaded via systemctl restart")
                return {"success": True, "method": "systemctl_restart"}
        except Exception as e:
            logger.debug(f"systemctl restart failed: {e}")
        
        # Try method 2: Send F5 via xdotool
        try:
            result = os.system('DISPLAY=:0 xdotool key F5 2>/dev/null')
            if result == 0:
                logger.info("✓ Browser reloaded via xdotool F5")
                return {"success": True, "method": "xdotool_f5"}
        except Exception as e:
            logger.debug(f"xdotool failed: {e}")
        
        # Try method 3: Restart chromium directly
        try:
            result = os.system('sudo systemctl restart chromium 2>/dev/null')
            if result == 0:
                logger.info("✓ Browser reloaded via chromium restart")
                return {"success": True, "method": "chromium_restart"}
        except Exception as e:
            logger.debug(f"chromium restart failed: {e}")
        
        logger.warning("⚠ Could not reload browser automatically")
        logger.info("URL will take effect on next browser restart")
        
        return {
            "success": False,
            "method": "none",
            "note": "URL will apply on next browser restart"
        }


class CECPowerOnExecutor(CommandExecutor):
    """Executor for CEC power on"""
    
    def __init__(self, config):
        super().__init__(config)
        self.cec = CECController(
            adapter=config.cec_adapter,
            display_address=config.cec_display_address,
        )
    
    def validate(self, command_data: Dict[str, Any]) -> bool:
        if not self.config.cec_enabled:
            logger.error("CEC not enabled in configuration")
            return False
        
        if not self.cec.available:
            logger.error("CEC not available on this system")
            return False
        
        return True
    
    def execute(self, command_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute CEC power on command"""
        logger.info("Executing CEC power on")
        
        timeout = command_data.get("timeout", self.config.cec_timeout)
        success, message = self.cec.power_on(timeout=timeout)
        
        if success:
            return {
                "status": "success",
                "message": message,
                "cec_available": True,
                "display_address": self.config.cec_display_address,
            }
        else:
            return {
                "status": "failed",
                "error": message,
                "cec_available": True,
                "display_address": self.config.cec_display_address,
            }


class CECPowerOffExecutor(CommandExecutor):
    """Executor for CEC power off"""
    
    def __init__(self, config):
        super().__init__(config)
        self.cec = CECController(
            adapter=config.cec_adapter,
            display_address=config.cec_display_address,
        )
    
    def validate(self, command_data: Dict[str, Any]) -> bool:
        if not self.config.cec_enabled:
            logger.error("CEC not enabled in configuration")
            return False
        
        if not self.cec.available:
            logger.error("CEC not available on this system")
            return False
        
        return True
    
    def execute(self, command_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute CEC power off command"""
        logger.info("Executing CEC power off (standby)")
        
        timeout = command_data.get("timeout", self.config.cec_timeout)
        success, message = self.cec.power_off(timeout=timeout)
        
        if success:
            return {
                "status": "success",
                "message": message,
                "cec_available": True,
                "display_address": self.config.cec_display_address,
            }
        else:
            return {
                "status": "failed",
                "error": message,
                "cec_available": True,
                "display_address": self.config.cec_display_address,
            }


class CECSetInputExecutor(CommandExecutor):
    """Executor for CEC input switching"""
    
    def __init__(self, config):
        super().__init__(config)
        self.cec = CECController(
            adapter=config.cec_adapter,
            display_address=config.cec_display_address,
        )
    
    def validate(self, command_data: Dict[str, Any]) -> bool:
        if not self.config.cec_enabled:
            logger.error("CEC not enabled in configuration")
            return False
        
        if not self.cec.available:
            logger.error("CEC not available on this system")
            return False
        
        if "input_address" not in command_data:
            logger.error("CEC set input command missing 'input_address' parameter")
            return False
        
        return True
    
    def execute(self, command_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute CEC input switch command"""
        input_address = command_data["input_address"]
        input_name = command_data.get("input_name", "Unknown")
        
        logger.info(f"Switching to CEC input: {input_name} ({input_address})")
        
        timeout = command_data.get("timeout", self.config.cec_timeout)
        success, message = self.cec.set_input(input_address, timeout=timeout)
        
        if success:
            return {
                "status": "success",
                "message": message,
                "input_address": input_address,
                "input_name": input_name,
                "cec_available": True,
            }
        else:
            return {
                "status": "failed",
                "error": message,
                "input_address": input_address,
                "input_name": input_name,
                "cec_available": True,
            }


class CECScanInputsExecutor(CommandExecutor):
    """Executor for CEC input scanning"""
    
    def __init__(self, config):
        super().__init__(config)
        self.cec = CECController(
            adapter=config.cec_adapter,
            display_address=config.cec_display_address,
        )
    
    def validate(self, command_data: Dict[str, Any]) -> bool:
        if not self.config.cec_enabled:
            logger.error("CEC not enabled in configuration")
            return False
        
        if not self.cec.available:
            logger.error("CEC not available on this system")
            return False
        
        return True
    
    def execute(self, command_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute CEC input scan command"""
        logger.info("Scanning for CEC devices/inputs")
        
        timeout = command_data.get("timeout", 15)
        success, devices = self.cec.scan_devices(timeout=timeout)
        
        if success:
            return {
                "status": "success",
                "message": f"Found {len(devices)} CEC device(s)",
                "devices": devices,
                "cec_available": True,
                "scan_timeout": timeout,
            }
        else:
            return {
                "status": "failed",
                "error": "CEC scan failed",
                "devices": [],
                "cec_available": True,
            }


class CommandExecutorFactory:
    """Factory for creating command executors"""
    
    def __init__(self, config):
        """
        Initialize factory
        
        Args:
            config: Daemon configuration object
        """
        self.config = config
        self._executors = {
            "test": TestCommandExecutor,
            "update_url": URLUpdateExecutor,
            "cec_power_on": CECPowerOnExecutor,
            "cec_power_off": CECPowerOffExecutor,
            "cec_set_input": CECSetInputExecutor,
            "cec_scan_inputs": CECScanInputsExecutor,
        }
    
    def get_executor(self, command_type: str) -> Optional[CommandExecutor]:
        """
        Get executor for command type
        
        Args:
            command_type: Type of command
        
        Returns:
            CommandExecutor instance or None if not found
        """
        executor_class = self._executors.get(command_type)
        
        if executor_class:
            return executor_class(self.config)
        
        logger.error(f"No executor found for command type: {command_type}")
        return None
    
    def register_executor(self, command_type: str, executor_class: type):
        """
        Register a new executor type
        
        Args:
            command_type: Command type identifier
            executor_class: Executor class
        """
        self._executors[command_type] = executor_class
        logger.info(f"Registered executor for command type: {command_type}")


if __name__ == "__main__":
    # Test executor factory
    logging.basicConfig(level=logging.INFO)
    
    print("Testing Command Executor Factory...")
    
    # Create mock config
    class MockConfig:
        cec_enabled = True
        fullpageos_config_path = "/boot/firmware/fullpageos.txt"
        fullpageos_backup_enabled = True
    
    config = MockConfig()
    factory = CommandExecutorFactory(config)
    
    # Test test command
    executor = factory.get_executor("test")
    if executor:
        result = executor.execute({"message": "Hello from test"})
        print(f"Test command result: {result}")
    
    # Test URL update
    executor = factory.get_executor("update_url")
    if executor:
        result = executor.execute({"url": "http://example.com"})
        print(f"URL update result: {result}")
    
    print("\n✅ Command executor factory tests complete!")


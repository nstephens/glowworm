"""
Command Executor Factory and Base Classes
Handles execution of commands received from the backend
"""
import logging
from typing import Dict, Any, Optional
from abc import ABC, abstractmethod

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
        if "url" not in command_data:
            logger.error("URL update command missing 'url' parameter")
            return False
        return True
    
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
        
        # TODO: Implement actual URL update (Task 6)
        # For now, return not_implemented status
        
        return {
            "status": "not_implemented",
            "message": "URL update feature will be implemented in Task 6",
            "url": url,
            "config_path": config_path,
        }


class CECPowerOnExecutor(CommandExecutor):
    """Executor for CEC power on"""
    
    def validate(self, command_data: Dict[str, Any]) -> bool:
        if not self.config.cec_enabled:
            logger.error("CEC not enabled in configuration")
            return False
        return True
    
    def execute(self, command_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute CEC power on command"""
        logger.info("Executing CEC power on")
        
        # TODO: Implement actual CEC control (Task 7)
        # For now, return not_implemented status
        
        return {
            "status": "not_implemented",
            "message": "CEC power on feature will be implemented in Task 7",
            "cec_enabled": self.config.cec_enabled,
        }


class CECPowerOffExecutor(CommandExecutor):
    """Executor for CEC power off"""
    
    def validate(self, command_data: Dict[str, Any]) -> bool:
        if not self.config.cec_enabled:
            logger.error("CEC not enabled in configuration")
            return False
        return True
    
    def execute(self, command_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute CEC power off command"""
        logger.info("Executing CEC power off")
        
        # TODO: Implement actual CEC control (Task 7)
        # For now, return not_implemented status
        
        return {
            "status": "not_implemented",
            "message": "CEC power off feature will be implemented in Task 7",
            "cec_enabled": self.config.cec_enabled,
        }


class CECSetInputExecutor(CommandExecutor):
    """Executor for CEC input switching"""
    
    def validate(self, command_data: Dict[str, Any]) -> bool:
        if not self.config.cec_enabled:
            logger.error("CEC not enabled in configuration")
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
        
        # TODO: Implement actual CEC control (Task 7)
        # For now, return not_implemented status
        
        return {
            "status": "not_implemented",
            "message": "CEC input switching feature will be implemented in Task 7",
            "input_address": input_address,
            "input_name": input_name,
        }


class CECScanInputsExecutor(CommandExecutor):
    """Executor for CEC input scanning"""
    
    def validate(self, command_data: Dict[str, Any]) -> bool:
        if not self.config.cec_enabled:
            logger.error("CEC not enabled in configuration")
            return False
        return True
    
    def execute(self, command_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute CEC input scan command"""
        logger.info("Scanning for CEC inputs")
        
        # TODO: Implement actual CEC scanning (Task 8)
        # For now, return not_implemented status
        
        return {
            "status": "not_implemented",
            "message": "CEC input scanning feature will be implemented in Task 8",
            "cec_enabled": self.config.cec_enabled,
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


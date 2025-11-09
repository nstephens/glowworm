"""
HDMI CEC Controller
Handles communication with displays via HDMI CEC protocol
"""
import subprocess
import logging
import re
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)


class CECController:
    """HDMI CEC controller for display management"""
    
    def __init__(self, adapter: str = "/dev/cec0", display_address: int = 0):
        """
        Initialize CEC controller
        
        Args:
            adapter: CEC adapter device path
            display_address: Display logical address (usually 0)
        """
        self.adapter = adapter
        self.display_address = display_address
        self.available = self._check_cec_available()
        
        if self.available:
            logger.info(f"CEC controller initialized (adapter: {adapter}, display: {display_address})")
        else:
            logger.warning("CEC not available on this system")
    
    def _check_cec_available(self) -> bool:
        """
        Check if CEC is available on the system
        
        Returns:
            True if CEC is available, False otherwise
        """
        try:
            # Check if cec-client is installed
            result = subprocess.run(
                ['which', 'cec-client'],
                capture_output=True,
                text=True,
                timeout=5,
            )
            
            if result.returncode != 0:
                logger.debug("cec-client not found in PATH")
                return False
            
            # Check if adapter exists
            import os
            if not os.path.exists(self.adapter):
                logger.debug(f"CEC adapter not found: {self.adapter}")
                return False
            
            logger.info("✓ CEC is available")
            return True
        
        except subprocess.TimeoutExpired:
            logger.warning("CEC availability check timed out")
            return False
        
        except Exception as e:
            logger.debug(f"CEC availability check failed: {e}")
            return False
    
    def power_on(self, timeout: int = 10) -> Tuple[bool, str]:
        """
        Turn display on via CEC
        
        Args:
            timeout: Command timeout in seconds
        
        Returns:
            Tuple of (success, message)
        """
        if not self.available:
            return (False, "CEC not available")
        
        logger.info(f"Sending CEC power on to display {self.display_address}")
        
        try:
            result = subprocess.run(
                ['cec-client', '-s', '-d', '1'],
                input=f'on {self.display_address}\n'.encode(),
                capture_output=True,
                timeout=timeout,
            )
            
            if result.returncode == 0:
                logger.info("✓ CEC power on command sent successfully")
                return (True, "Power on command sent")
            else:
                error_msg = result.stderr.decode().strip() if result.stderr else "Unknown error"
                logger.warning(f"CEC power on failed: {error_msg}")
                return (False, f"Command failed: {error_msg}")
        
        except subprocess.TimeoutExpired:
            logger.error(f"CEC power on timed out after {timeout}s")
            return (False, "Command timed out")
        
        except Exception as e:
            logger.error(f"CEC power on error: {e}", exc_info=True)
            return (False, f"Error: {str(e)}")
    
    def power_off(self, timeout: int = 10) -> Tuple[bool, str]:
        """
        Turn display off via CEC (standby mode)
        
        Args:
            timeout: Command timeout in seconds
        
        Returns:
            Tuple of (success, message)
        """
        if not self.available:
            return (False, "CEC not available")
        
        logger.info(f"Sending CEC standby to display {self.display_address}")
        
        try:
            result = subprocess.run(
                ['cec-client', '-s', '-d', '1'],
                input=f'standby {self.display_address}\n'.encode(),
                capture_output=True,
                timeout=timeout,
            )
            
            if result.returncode == 0:
                logger.info("✓ CEC standby command sent successfully")
                return (True, "Standby command sent")
            else:
                error_msg = result.stderr.decode().strip() if result.stderr else "Unknown error"
                logger.warning(f"CEC standby failed: {error_msg}")
                return (False, f"Command failed: {error_msg}")
        
        except subprocess.TimeoutExpired:
            logger.error(f"CEC standby timed out after {timeout}s")
            return (False, "Command timed out")
        
        except Exception as e:
            logger.error(f"CEC standby error: {e}", exc_info=True)
            return (False, f"Error: {str(e)}")
    
    def set_input(self, input_address: str, timeout: int = 10) -> Tuple[bool, str]:
        """
        Switch to specific HDMI input via CEC
        
        Args:
            input_address: CEC logical address (e.g., "1", "3") or "self" to make this device active
            timeout: Command timeout in seconds
        
        Returns:
            Tuple of (success, message)
        """
        if not self.available:
            return (False, "CEC not available")
        
        logger.info(f"Switching to CEC input: {input_address}")
        
        # Determine command based on address
        if input_address in ["self", "this", ""] or input_address.startswith("3."):
            # Make this device (the Pi) the active source
            # This is the most common use case - taking over from FireTV/SmartTV apps
            cmd = 'as\n'
            logger.debug("Using 'as' command to make Pi the active source")
        elif input_address.isdigit():
            # Simple logical address - make that device active
            cmd = f'as {input_address}\n'
            logger.debug(f"Using 'as {input_address}' to make device {input_address} active")
        else:
            # Physical address format (e.g., "1.0.0.0")
            # Convert to CEC active source command
            # Remove dots and use as hex bytes in tx command
            physical_hex = input_address.replace(".", "")
            cmd = f'tx 0F:82:{physical_hex}\n'
            logger.debug(f"Using tx command for physical address {input_address}")
        
        try:
            result = subprocess.run(
                ['cec-client', '-s', '-d', '1'],
                input=cmd,
                capture_output=True,
                timeout=timeout,
                text=True,
            )
            
            if result.returncode == 0:
                logger.info(f"✓ CEC input switch command sent")
                return (True, f"Switched to input {input_address}")
            else:
                error_msg = result.stderr.strip() if result.stderr else "Unknown error"
                logger.warning(f"CEC input switch failed: {error_msg}")
                return (False, f"Command failed: {error_msg}")
        
        except subprocess.TimeoutExpired:
            logger.error(f"CEC input switch timed out after {timeout}s")
            return (False, "Command timed out")
        
        except Exception as e:
            logger.error(f"CEC input switch error: {e}", exc_info=True)
            return (False, f"Error: {str(e)}")
    
    def scan_devices(self, timeout: int = 15) -> Tuple[bool, List[Dict[str, Any]]]:
        """
        Scan for CEC devices on the bus
        
        Args:
            timeout: Scan timeout in seconds
        
        Returns:
            Tuple of (success, list of detected devices)
        """
        if not self.available:
            return (False, [])
        
        logger.info("Scanning for CEC devices...")
        
        try:
            result = subprocess.run(
                ['cec-client', '-s', '-d', '1'],
                input='scan\n',  # Use string, not bytes, when text=True
                capture_output=True,
                timeout=timeout,
                text=True,
            )
            
            if result.returncode == 0:
                # Parse scan output
                devices = self._parse_scan_output(result.stdout)
                logger.info(f"✓ Found {len(devices)} CEC device(s)")
                return (True, devices)
            else:
                logger.warning("CEC scan failed")
                return (False, [])
        
        except subprocess.TimeoutExpired:
            logger.error(f"CEC scan timed out after {timeout}s")
            return (False, [])
        
        except Exception as e:
            logger.error(f"CEC scan error: {e}", exc_info=True)
            return (False, [])
    
    def _parse_scan_output(self, output: str) -> List[Dict[str, Any]]:
        """
        Parse cec-client scan output
        
        Args:
            output: Raw scan output from cec-client
        
        Returns:
            List of detected devices with name and address
        """
        devices = []
        
        # Look for lines like: "device #1: TV"
        # or "device #4: Playback 1"
        device_pattern = r'device\s+#(\d+):\s+(.+)'
        
        for line in output.split('\n'):
            match = re.search(device_pattern, line)
            if match:
                address = match.group(1)
                name = match.group(2).strip()
                
                devices.append({
                    "address": address,
                    "name": name,
                    "type": self._guess_device_type(name),
                })
                
                logger.debug(f"Found CEC device: {name} at address {address}")
        
        return devices
    
    def _guess_device_type(self, name: str) -> str:
        """
        Guess device type from name
        
        Args:
            name: Device name from CEC scan
        
        Returns:
            Device type string
        """
        name_lower = name.lower()
        
        if 'tv' in name_lower or 'display' in name_lower:
            return 'display'
        elif 'playback' in name_lower or 'player' in name_lower:
            return 'playback'
        elif 'recorder' in name_lower or 'recording' in name_lower:
            return 'recorder'
        elif 'tuner' in name_lower:
            return 'tuner'
        elif 'audio' in name_lower:
            return 'audio'
        else:
            return 'unknown'
    
    def get_power_status(self, timeout: int = 5) -> Optional[str]:
        """
        Get current power status of display
        
        Args:
            timeout: Command timeout in seconds
        
        Returns:
            "on", "standby", or None if unavailable
        """
        if not self.available:
            return None
        
        try:
            result = subprocess.run(
                ['cec-client', '-s', '-d', '1'],
                input=f'pow {self.display_address}\n'.encode(),
                capture_output=True,
                timeout=timeout,
                text=True,
            )
            
            if result.returncode == 0:
                # Parse output for power status
                if 'power status: on' in result.stdout.lower():
                    return "on"
                elif 'power status: standby' in result.stdout.lower():
                    return "standby"
            
            return None
        
        except Exception as e:
            logger.debug(f"Failed to get power status: {e}")
            return None
    
    def get_active_source(self, timeout: int = 5) -> Optional[Dict[str, Any]]:
        """
        Get currently active HDMI source
        
        Args:
            timeout: Command timeout in seconds
        
        Returns:
            Dict with active source info or None
        """
        if not self.available:
            return None
        
        logger.debug("Querying active CEC source...")
        
        try:
            # Use 'pow' command to get device status which includes active source
            result = subprocess.run(
                ['cec-client', '-s', '-d', '8'],  # Query for 8 seconds max
                input='scan\n',
                capture_output=True,
                timeout=timeout,
                text=True,
            )
            
            if result.returncode == 0:
                # Parse for "currently active source: <name> (<address>)"
                match = re.search(r'currently active source:\s+([^(]+)\((\d+)\)', result.stdout, re.IGNORECASE)
                
                if match:
                    name = match.group(1).strip()
                    address = match.group(2)
                    logger.debug(f"Active source: {name} ({address})")
                    
                    return {
                        "address": address,
                        "name": name,
                        "detected": True,
                    }
            
            logger.debug("Could not determine active source")
            return None
        
        except subprocess.TimeoutExpired:
            logger.debug("Active source query timed out")
            return None
        
        except Exception as e:
            logger.debug(f"Failed to get active source: {e}")
            return None
    
    def power_on_and_switch(self, max_retries: int = 12, retry_interval: int = 5) -> Tuple[bool, str]:
        """
        Power on display and ensure it switches to this device
        
        Smart TVs often boot to their built-in apps (FireTV, etc.).
        This command powers on the TV, then keeps trying to switch to
        the Pi until successful or max retries reached.
        
        Args:
            max_retries: Number of times to retry switch (default 12 = 60 seconds)
            retry_interval: Seconds between retries (default 5)
        
        Returns:
            Tuple of (success, message)
        """
        if not self.available:
            return (False, "CEC not available")
        
        logger.info("Powering on display and switching to this device...")
        
        # Step 1: Power on the display
        power_success, power_msg = self.power_on()
        if not power_success:
            return (False, f"Power on failed: {power_msg}")
        
        logger.info("✓ Display powered on, waiting for boot and switching input...")
        
        # Step 2: Wait a moment for TV to boot
        import time
        time.sleep(3)
        
        # Step 3: Try to switch to Pi, with retries
        successful_sends = 0
        for attempt in range(max_retries):
            logger.info(f"Switch attempt {attempt + 1}/{max_retries}...")
            
            # Make this device active
            switch_success, switch_msg = self.set_input("self")
            
            if switch_success:
                successful_sends += 1
                
                # Wait a moment, then check if we're actually active
                time.sleep(2)
                
                active_source = self.get_active_source()
                if active_source:
                    # Check if we (device 1/Recorder) are active
                    # Pi is typically device 1, so check for "1" or "Recorder"
                    if active_source.get("address") == "1" or "recorder" in active_source.get("name", "").lower():
                        logger.info(f"✓ Successfully switched to Pi (verified)")
                        return (True, f"Display powered on and switched to Pi (took {attempt + 1} attempts)")
                
                logger.debug(f"Switch command sent but not yet active (current: {active_source})")
                
                # If we've sent the command successfully 3+ times but can't verify,
                # assume it worked (some TVs don't respond to status queries)
                if successful_sends >= 3 and active_source is None:
                    logger.info(f"✓ Sent switch command {successful_sends} times - assuming successful (TV not responding to queries)")
                    return (True, f"Display powered on and switched to Pi (verification unavailable after {successful_sends} attempts)")
            
            # Not active yet, retry if we have attempts left
            if attempt < max_retries - 1:
                logger.debug(f"Retrying in {retry_interval}s...")
                time.sleep(retry_interval)
        
        # Max retries reached
        logger.warning(f"Display powered on but input switch unverified after {max_retries} attempts")
        return (True, f"Display powered on (input switch attempted but not confirmed)")


if __name__ == "__main__":
    # Test CEC controller
    logging.basicConfig(level=logging.INFO)
    
    print("Testing CEC Controller...")
    print()
    
    controller = CECController()
    print(f"CEC Available: {controller.available}")
    
    if controller.available:
        print("\n1. Testing device scan...")
        success, devices = controller.scan_devices()
        if success:
            print(f"Found {len(devices)} device(s):")
            for device in devices:
                print(f"  - {device['name']} (address: {device['address']}, type: {device['type']})")
        
        print("\n2. Testing power status...")
        status = controller.get_power_status()
        print(f"Power status: {status or 'unknown'}")
        
        print("\n3. CEC commands available:")
        print("  - power_on()")
        print("  - power_off()")
        print("  - set_input(address)")
        print("  - scan_devices()")
    else:
        print("\n⚠ CEC not available on this system")
        print("Install with: sudo apt-get install cec-utils")
    
    print("\n✅ CEC controller test complete!")


"""
Interactive setup wizard for Glowworm daemon
Creates configuration file and registers device with backend
"""
import os
import sys
import logging
import configparser
import requests
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def setup_wizard() -> None:
    """Interactive setup wizard"""
    print("=" * 60)
    print("Glowworm Display Device Daemon - Setup Wizard")
    print("=" * 60)
    print()
    
    # Check if running as root
    if os.geteuid() != 0:
        print("⚠️  Warning: This script should be run as root")
        print("   Please run: sudo glowworm-daemon-setup")
        print()
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            sys.exit(0)
    
    # Gather configuration
    config = {}
    
    # Glowworm URL
    print("\n📡 Glowworm Configuration")
    print("-" * 40)
    print("Enter the URL you use to access the Glowworm admin UI")
    print("(The daemon will connect via the frontend, which proxies API requests)")
    default_url = "http://10.10.10.2:3003"
    backend_url = input(f"Glowworm URL [{default_url}]: ").strip() or default_url
    config['backend_url'] = backend_url
    
    # Device token
    print("\n🔑 Device Authentication")
    print("-" * 40)
    print("You need to register this device in the Glowworm admin UI")
    print("and obtain an authentication token.")
    print()
    device_token = input("Device Token: ").strip()
    if not device_token:
        print("❌ Device token is required!")
        sys.exit(1)
    config['device_token'] = device_token
    
    # Poll interval
    print("\n⏱️  Polling Configuration")
    print("-" * 40)
    poll_interval = input("Poll interval in seconds [5]: ").strip() or "5"
    config['poll_interval'] = poll_interval
    
    # Log level
    print("\n📝 Logging Configuration")
    print("-" * 40)
    log_level = input("Log level (DEBUG/INFO/WARNING/ERROR) [INFO]: ").strip() or "INFO"
    config['log_level'] = log_level.upper()
    
    # CEC configuration
    print("\n📺 HDMI CEC Configuration")
    print("-" * 40)
    cec_enabled = input("Enable HDMI CEC control? (y/n) [y]: ").strip().lower()
    config['cec_enabled'] = 'true' if cec_enabled in ['', 'y', 'yes'] else 'false'
    
    if config['cec_enabled'] == 'true':
        cec_adapter = input("CEC adapter device [/dev/cec0]: ").strip() or "/dev/cec0"
        config['cec_adapter'] = cec_adapter
        
        cec_display = input("Display logical address [0]: ").strip() or "0"
        config['cec_display_address'] = cec_display
    
    # FullPageOS configuration
    print("\n🌐 FullPageOS Configuration")
    print("-" * 40)
    fullpageos_path = input(
        "FullPageOS config path [/boot/firmware/fullpageos.txt]: "
    ).strip() or "/boot/firmware/fullpageos.txt"
    config['fullpageos_config_path'] = fullpageos_path
    
    # Test connectivity
    print("\n🔍 Testing connectivity...")
    if test_backend_connection(backend_url, device_token):
        print("✅ Successfully connected to backend!")
    else:
        print("⚠️  Could not connect to backend (you can fix this later)")
    
    # Create configuration file
    print("\n💾 Creating configuration...")
    config_path = "/etc/glowworm/daemon.conf"
    create_config_file(config_path, config)
    print(f"✅ Configuration saved to {config_path}")
    
    # Create log directory
    log_dir = "/var/log/glowworm"
    os.makedirs(log_dir, exist_ok=True)
    print(f"✅ Log directory created: {log_dir}")
    
    # Create working directory
    work_dir = "/var/lib/glowworm"
    os.makedirs(work_dir, exist_ok=True)
    print(f"✅ Working directory created: {work_dir}")
    
    # Install systemd service
    print("\n🔧 Installing systemd service...")
    install_systemd_service()
    
    # Summary
    print("\n" + "=" * 60)
    print("✅ Setup complete!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("  1. Start the daemon:  sudo systemctl start glowworm-daemon")
    print("  2. Enable on boot:    sudo systemctl enable glowworm-daemon")
    print("  3. Check status:      sudo systemctl status glowworm-daemon")
    print("  4. View logs:         sudo journalctl -u glowworm-daemon -f")
    print()
    print("Configuration file: /etc/glowworm/daemon.conf")
    print("Logs directory:     /var/log/glowworm/")
    print()


def test_backend_connection(backend_url: str, device_token: str) -> bool:
    """
    Test connection to backend
    
    Returns:
        True if connection successful
    """
    try:
        url = f"{backend_url}/health"
        response = requests.get(url, timeout=5)
        return response.status_code == 200
    except Exception as e:
        logger.debug(f"Connection test failed: {e}")
        return False


def create_config_file(config_path: str, config: dict) -> None:
    """
    Create configuration file
    
    Args:
        config_path: Path to config file
        config: Configuration dictionary
    """
    # Ensure directory exists
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    
    # Create config parser
    parser = configparser.ConfigParser()
    
    # Daemon section
    parser.add_section('daemon')
    parser.set('daemon', 'backend_url', config['backend_url'])
    parser.set('daemon', 'device_token', config['device_token'])
    parser.set('daemon', 'poll_interval', config['poll_interval'])
    parser.set('daemon', 'log_level', config['log_level'])
    parser.set('daemon', 'log_file', '/var/log/glowworm/daemon.log')
    parser.set('daemon', 'max_retries', '3')
    parser.set('daemon', 'retry_delay', '5')
    
    # CEC section
    parser.add_section('cec')
    parser.set('cec', 'enabled', config['cec_enabled'])
    if config['cec_enabled'] == 'true':
        parser.set('cec', 'display_address', config.get('cec_display_address', '0'))
        parser.set('cec', 'adapter', config.get('cec_adapter', '/dev/cec0'))
        parser.set('cec', 'timeout', '5')
    
    # FullPageOS section
    parser.add_section('fullpageos')
    parser.set('fullpageos', 'config_path', config['fullpageos_config_path'])
    parser.set('fullpageos', 'backup_enabled', 'true')
    
    # Write to file
    with open(config_path, 'w') as f:
        f.write("# Glowworm Display Device Daemon Configuration\n")
        f.write("# Generated by setup wizard\n\n")
        parser.write(f)
    
    # Set permissions
    os.chmod(config_path, 0o600)


def install_systemd_service() -> None:
    """Install systemd service file"""
    service_content = """[Unit]
Description=Glowworm Display Device Daemon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root
ExecStart=/opt/glowworm-daemon/venv/bin/python -m glowworm_daemon.main
Restart=always
RestartSec=10
Environment="PYTHONUNBUFFERED=1"
Environment="PATH=/opt/glowworm-daemon/venv/bin:/usr/local/bin:/usr/bin:/bin"
StandardOutput=journal
StandardError=journal
SyslogIdentifier=glowworm-daemon
WorkingDirectory=/var/lib/glowworm

[Install]
WantedBy=multi-user.target
"""
    
    service_path = "/etc/systemd/system/glowworm-daemon.service"
    
    try:
        with open(service_path, 'w') as f:
            f.write(service_content)
        
        os.chmod(service_path, 0o644)
        
        # Reload systemd
        os.system("systemctl daemon-reload")
        
        print(f"✅ Systemd service installed: {service_path}")
    
    except Exception as e:
        print(f"⚠️  Failed to install systemd service: {e}")


if __name__ == "__main__":
    setup_wizard()


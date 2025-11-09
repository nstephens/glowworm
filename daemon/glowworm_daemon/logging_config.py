"""
Logging configuration with rotation for Glowworm daemon
Supports both file and systemd journal logging
"""
import os
import sys
import logging
from logging.handlers import RotatingFileHandler, SysLogHandler
from pathlib import Path
from typing import Optional


def setup_logging(
    log_level: str = "INFO",
    log_file: Optional[str] = None,
    max_bytes: int = 10 * 1024 * 1024,  # 10 MB
    backup_count: int = 5,
    use_systemd: bool = True,
) -> None:
    """
    Configure logging for the daemon with rotation
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Path to log file (None = console only)
        max_bytes: Maximum log file size before rotation
        backup_count: Number of backup files to keep
        use_systemd: Whether to also log to systemd journal
    """
    # Convert log level string to logging constant
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    
    # Create root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)
    
    # Remove any existing handlers
    root_logger.handlers.clear()
    
    # Create formatters
    detailed_formatter = logging.Formatter(
        fmt="%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    
    simple_formatter = logging.Formatter(
        fmt="%(levelname)s - %(message)s"
    )
    
    # Console handler (for non-systemd environments)
    if not use_systemd or not _is_running_under_systemd():
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(numeric_level)
        console_handler.setFormatter(detailed_formatter)
        root_logger.addHandler(console_handler)
    
    # File handler with rotation
    if log_file:
        try:
            # Ensure log directory exists
            log_dir = os.path.dirname(log_file)
            if log_dir:
                os.makedirs(log_dir, exist_ok=True)
            
            # Create rotating file handler
            file_handler = RotatingFileHandler(
                log_file,
                maxBytes=max_bytes,
                backupCount=backup_count,
                encoding="utf-8",
            )
            file_handler.setLevel(numeric_level)
            file_handler.setFormatter(detailed_formatter)
            root_logger.addHandler(file_handler)
            
            logging.info(f"File logging enabled: {log_file}")
            logging.info(f"Log rotation: max_bytes={max_bytes}, backups={backup_count}")
        
        except Exception as e:
            logging.error(f"Failed to setup file logging to {log_file}: {e}")
    
    # Systemd journal handler (when running as systemd service)
    if use_systemd and _is_running_under_systemd():
        try:
            # Try to import systemd.journal
            try:
                from systemd import journal
                
                # Create journal handler
                journal_handler = journal.JournalHandler()
                journal_handler.setLevel(numeric_level)
                # Systemd journal doesn't need timestamps (it adds them)
                journal_handler.setFormatter(simple_formatter)
                root_logger.addHandler(journal_handler)
                
                logging.info("Systemd journal logging enabled")
            
            except ImportError:
                # Fallback to syslog if systemd.journal not available
                syslog_handler = SysLogHandler(address="/dev/log")
                syslog_handler.setLevel(numeric_level)
                syslog_handler.setFormatter(simple_formatter)
                root_logger.addHandler(syslog_handler)
                
                logging.info("Syslog logging enabled (systemd.journal not available)")
        
        except Exception as e:
            logging.warning(f"Failed to setup systemd/syslog logging: {e}")
    
    # Log the configuration
    logging.info(f"Logging initialized: level={log_level}")
    if log_file:
        logging.info(f"Log file: {log_file}")


def _is_running_under_systemd() -> bool:
    """
    Check if the process is running under systemd
    
    Returns:
        True if running under systemd, False otherwise
    """
    # Check for INVOCATION_ID environment variable (set by systemd)
    if os.environ.get("INVOCATION_ID"):
        return True
    
    # Check for systemd in parent process
    try:
        with open("/proc/1/comm", "r") as f:
            init_process = f.read().strip()
            if init_process == "systemd":
                return True
    except Exception:
        pass
    
    return False


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance
    
    Args:
        name: Logger name (typically __name__)
    
    Returns:
        Logger instance
    """
    return logging.getLogger(name)


class LogContext:
    """Context manager for temporary log level changes"""
    
    def __init__(self, logger: logging.Logger, level: int):
        self.logger = logger
        self.new_level = level
        self.old_level = None
    
    def __enter__(self):
        self.old_level = self.logger.level
        self.logger.setLevel(self.new_level)
        return self.logger
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.logger.setLevel(self.old_level)


def debug_context(logger: logging.Logger):
    """
    Context manager to temporarily enable debug logging
    
    Usage:
        with debug_context(logger):
            # Debug logging enabled here
            logger.debug("Detailed debug info")
    """
    return LogContext(logger, logging.DEBUG)


if __name__ == "__main__":
    # Test logging setup
    print("Testing logging configuration...")
    
    # Test with file logging
    test_log_file = "/tmp/glowworm_daemon_test.log"
    setup_logging(
        log_level="DEBUG",
        log_file=test_log_file,
        use_systemd=False,
    )
    
    # Create test logger
    logger = get_logger(__name__)
    
    # Test different log levels
    logger.debug("This is a debug message")
    logger.info("This is an info message")
    logger.warning("This is a warning message")
    logger.error("This is an error message")
    
    # Test context manager
    logger.setLevel(logging.INFO)
    logger.debug("This debug message won't appear")
    
    with debug_context(logger):
        logger.debug("This debug message WILL appear (in context)")
    
    logger.debug("This debug message won't appear again")
    
    print(f"\nLog file created: {test_log_file}")
    print("Check the file to verify logging works correctly")
    
    # Display log content
    if os.path.exists(test_log_file):
        print("\n--- Log Contents ---")
        with open(test_log_file, "r") as f:
            print(f.read())


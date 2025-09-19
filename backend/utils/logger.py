"""
Centralized logging utility for GlowWorm application.
Provides configurable logging levels based on system settings.
"""

import logging
import sys
from typing import Optional

class GlowWormLogger:
    """Centralized logger with configurable levels"""
    
    def __init__(self, name: str):
        self.name = name
        self.logger = logging.getLogger(name)
        self._setup_logger()
    
    def _setup_logger(self):
        """Setup logger with appropriate level and formatting"""
        if not self.logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
        
        # Set log level based on settings (lazy import to avoid circular dependencies)
        try:
            from config.settings import settings
            log_level = getattr(logging, settings.log_level.upper(), logging.INFO)
            self.logger.setLevel(log_level)
        except Exception:
            self.logger.setLevel(logging.INFO)
    
    def debug(self, message: str, *args, **kwargs):
        """Log debug message"""
        self.logger.debug(message, *args, **kwargs)
    
    def info(self, message: str, *args, **kwargs):
        """Log info message"""
        self.logger.info(message, *args, **kwargs)
    
    def warning(self, message: str, *args, **kwargs):
        """Log warning message"""
        self.logger.warning(message, *args, **kwargs)
    
    def error(self, message: str, *args, **kwargs):
        """Log error message"""
        self.logger.error(message, *args, **kwargs)
    
    def critical(self, message: str, *args, **kwargs):
        """Log critical message"""
        self.logger.critical(message, *args, **kwargs)

def get_logger(name: str) -> GlowWormLogger:
    """Get a logger instance for the given name"""
    return GlowWormLogger(name)

# Global logger instance for backwards compatibility
logger = get_logger(__name__)

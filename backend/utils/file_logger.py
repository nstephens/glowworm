"""
File logging configuration for backend and frontend logs
Stores logs in Docker volume for persistence
"""
import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Log directory - mounted as Docker volume
LOG_DIR = Path("/app/logs")

def setup_file_logging():
    """Configure file logging for the backend"""
    # Ensure log directory exists
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    
    # Configure root logger
    root_logger = logging.getLogger()
    
    # Backend application logs
    backend_log_file = LOG_DIR / "backend.log"
    backend_handler = RotatingFileHandler(
        backend_log_file,
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,  # Keep 5 backup files
        encoding='utf-8'
    )
    backend_handler.setLevel(logging.INFO)
    backend_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    backend_handler.setFormatter(backend_formatter)
    root_logger.addHandler(backend_handler)
    
    logging.info("✅ File logging configured - logs will be saved to /app/logs")

def get_log_file_path(log_type: str) -> Path:
    """Get the path to a specific log file"""
    log_files = {
        "backend": LOG_DIR / "backend.log",
        "frontend": LOG_DIR / "frontend.log",
    }
    return log_files.get(log_type, LOG_DIR / f"{log_type}.log")

def read_log_file(log_type: str, lines: int = 1000) -> list[str]:
    """Read the last N lines from a log file"""
    log_file = get_log_file_path(log_type)
    
    if not log_file.exists():
        return []
    
    try:
        with open(log_file, 'r', encoding='utf-8') as f:
            # Read all lines and return the last N
            all_lines = f.readlines()
            return all_lines[-lines:] if len(all_lines) > lines else all_lines
    except Exception as e:
        logging.error(f"Failed to read log file {log_file}: {e}")
        return []

def write_frontend_log(log_level: str, message: str, context: dict = None):
    """Write a frontend log entry to the frontend log file"""
    frontend_log_file = LOG_DIR / "frontend.log"
    
    try:
        # Create handler if needed
        frontend_logger = logging.getLogger('frontend')
        
        if not any(isinstance(h, RotatingFileHandler) and h.baseFilename == str(frontend_log_file) for h in frontend_logger.handlers):
            handler = RotatingFileHandler(
                frontend_log_file,
                maxBytes=10 * 1024 * 1024,  # 10MB
                backupCount=5,
                encoding='utf-8'
            )
            formatter = logging.Formatter(
                '%(asctime)s - %(levelname)s - %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )
            handler.setFormatter(formatter)
            frontend_logger.addHandler(handler)
            frontend_logger.setLevel(logging.DEBUG)
        
        # Log the message
        log_func = getattr(frontend_logger, log_level.lower(), frontend_logger.info)
        
        if context:
            import json
            log_func(f"{message} | Context: {json.dumps(context)}")
        else:
            log_func(message)
            
    except Exception as e:
        logging.error(f"Failed to write frontend log: {e}")

def clear_log_file(log_type: str) -> bool:
    """Clear a log file by truncating it"""
    log_file = get_log_file_path(log_type)
    
    if not log_file.exists():
        logging.warning(f"Log file does not exist: {log_file}")
        return False
    
    try:
        # Truncate the file
        with open(log_file, 'w', encoding='utf-8') as f:
            f.write("")  # Clear the file
        
        logging.info(f"Cleared log file: {log_file}")
        return True
        
    except Exception as e:
        logging.error(f"Failed to clear log file {log_file}: {e}")
        return False


"""
Logging configuration for the UI/UX Lesson Bot.
"""

import logging
import logging.handlers
import os
import sys

from app.config import settings


def setup_logging():
    """Configure logging for the application"""
    # Set up root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.LOG_LEVEL))
    
    # Create formatter
    formatter = logging.Formatter(settings.LOG_FORMAT)
    
    # Add console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # Add file handler if LOG_FILE is specified
    if settings.LOG_FILE:
        try:
            # Ensure log directory exists
            log_dir = os.path.dirname(settings.LOG_FILE)
            if log_dir:
                os.makedirs(log_dir, exist_ok=True)
                
            # Create rotating file handler
            file_handler = logging.handlers.RotatingFileHandler(
                settings.LOG_FILE, maxBytes=10*1024*1024, backupCount=5
            )
            file_handler.setFormatter(formatter)
            root_logger.addHandler(file_handler)
        except Exception as e:
            print(f"Error setting up file logging: {e}", file=sys.stderr)
    
    # Set specific levels for certain modules
    # Libraries that might be too verbose
    logging.getLogger("telegram").setLevel(logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    
    # Our application loggers
    logging.getLogger("app.api.image_manager").setLevel(getattr(logging, settings.LOG_LEVEL))
    logging.getLogger("app.api.unsplash_client").setLevel(getattr(logging, settings.LOG_LEVEL))
    logging.getLogger("app.api.openai_client").setLevel(getattr(logging, settings.LOG_LEVEL))
    logging.getLogger("app.bot.handlers").setLevel(getattr(logging, settings.LOG_LEVEL))
    
    # Log startup information
    logger = logging.getLogger(__name__)
    logger.info(f"Logging initialized with level: {settings.LOG_LEVEL}")
    if settings.LOG_FILE:
        logger.info(f"Log file: {settings.LOG_FILE}")
    
    return logger 
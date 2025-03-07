"""
Utility functions for health status management.
These are shared between persistence.py and database.py to avoid circular imports.
"""

import os
import json
import time
import logging
from typing import Dict, Any

from app.config import settings

# Configure logger
logger = logging.getLogger(__name__)

def load_health_from_file() -> Dict[str, Any]:
    """
    Load health status from file.
    Used as a fallback when Supabase is not available or has errors.
    """
    health_file = os.path.join(settings.DATA_DIR, "health.json")
    
    # Default health status
    current_time = int(time.time())
    health_status = {
        "start_time": current_time,
        "last_activity": current_time,
        "lessons_sent": 0,
        "errors": 0
    }
    
    try:
        if os.path.exists(health_file):
            with open(health_file, "r") as f:
                health_status = json.load(f)
                logger.info("Loaded health status from file")
    except Exception as e:
        logger.error(f"Error loading health status from file: {e}")
    
    return health_status

def update_health_in_file(activity: bool = True, lesson_sent: bool = False, error: bool = False) -> Dict[str, Any]:
    """
    Update health status in the file system.
    Used as a fallback when Supabase is not available.
    
    Args:
        activity: Whether to update the last activity time
        lesson_sent: Whether to increment the lessons sent counter
        error: Whether to increment the error counter
        
    Returns:
        Updated health status dictionary
    """
    # Load current health status
    health_status = load_health_from_file()
    current_time = int(time.time())
    
    # Update values
    if activity:
        health_status["last_activity"] = current_time
    
    if lesson_sent:
        health_status["lessons_sent"] += 1
    
    if error:
        health_status["errors"] += 1
    
    # Save to file
    try:
        health_file = os.path.join(settings.DATA_DIR, "health.json")
        os.makedirs(os.path.dirname(health_file), exist_ok=True)
        with open(health_file, "w") as f:
            json.dump(health_status, f)
            logger.info("Saved health status to file")
    except Exception as e:
        logger.error(f"Error saving health status to file: {e}")
    
    return health_status 
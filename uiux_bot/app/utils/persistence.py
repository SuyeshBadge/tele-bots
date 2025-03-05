"""
Utility functions for data persistence (subscribers, health status).
"""

import os
import json
import time
import logging
from typing import Set, Dict, Any

from app.config import settings

# Configure logger
logger = logging.getLogger(__name__)

# Global variables
subscribers = set()
health_status = {
    "last_activity": int(time.time()),
    "lessons_sent": 0,
    "errors": 0,
    "start_time": int(time.time())
}


def load_subscribers() -> Set[int]:
    """Load subscribers from file"""
    global subscribers
    try:
        if os.path.exists(settings.SUBSCRIBERS_FILE):
            with open(settings.SUBSCRIBERS_FILE, "r") as f:
                subscribers = set(json.load(f))
                logger.info(f"Loaded {len(subscribers)} subscribers")
    except Exception as e:
        logger.error(f"Error loading subscribers: {e}")
        # Initialize empty set if loading fails
        subscribers = set()
    
    return subscribers


def save_subscribers() -> bool:
    """Save subscribers to file"""
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(settings.SUBSCRIBERS_FILE), exist_ok=True)
        with open(settings.SUBSCRIBERS_FILE, "w") as f:
            json.dump(list(subscribers), f)
        logger.info(f"Saved {len(subscribers)} subscribers")
        return True
    except Exception as e:
        logger.error(f"Error saving subscribers: {e}")
        return False


def add_subscriber(user_id: int) -> bool:
    """Add a subscriber and save to file"""
    global subscribers
    if user_id not in subscribers:
        subscribers.add(user_id)
        return save_subscribers()
    return True


def remove_subscriber(user_id: int) -> bool:
    """Remove a subscriber and save to file"""
    global subscribers
    if user_id in subscribers:
        subscribers.discard(user_id)
        return save_subscribers()
    return True


def get_subscribers() -> Set[int]:
    """Get the current set of subscribers"""
    global subscribers
    return subscribers


def update_health_status(activity: bool = True, lesson_sent: bool = False, error: bool = False) -> Dict[str, Any]:
    """Update and save health status"""
    global health_status
    
    if activity:
        health_status["last_activity"] = int(time.time())
    
    if lesson_sent:
        health_status["lessons_sent"] += 1
    
    if error:
        health_status["errors"] += 1
    
    try:
        with open(settings.HEALTH_FILE, "w") as f:
            json.dump(health_status, f)
    except Exception as e:
        logger.error(f"Error saving health status: {e}")
    
    return health_status


def get_health_status() -> Dict[str, Any]:
    """Get the current health status"""
    global health_status
    return health_status 
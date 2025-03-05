"""
Utility functions for data persistence (subscribers, health status).
"""

import os
import json
import time
import logging
import asyncio
import sys
from typing import Set, Dict, Any, List

from app.config import settings

# Configure logger
logger = logging.getLogger(__name__)

# Global variables
subscribers = set()
user_history = {}  # Store user message and topic history
health_status = {
    "last_activity": int(time.time()),
    "lessons_sent": 0,
    "errors": 0,
    "start_time": int(time.time())
}

# File paths
USER_HISTORY_FILE = os.path.join(settings.DATA_DIR, "user_history.json")


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
    
    # Also load user history
    load_user_history()
    
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


def load_user_history() -> Dict[str, Any]:
    """Load user message history from file"""
    global user_history
    try:
        if os.path.exists(USER_HISTORY_FILE):
            with open(USER_HISTORY_FILE, "r") as f:
                user_history = json.load(f)
                logger.info(f"Loaded history for {len(user_history)} users")
    except Exception as e:
        logger.error(f"Error loading user history: {e}")
        # Initialize empty dict if loading fails
        user_history = {}
    
    return user_history


def save_user_history() -> bool:
    """Save user message history to file"""
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(USER_HISTORY_FILE), exist_ok=True)
        with open(USER_HISTORY_FILE, "w") as f:
            json.dump(user_history, f)
        logger.info(f"Saved history for {len(user_history)} users")
        return True
    except Exception as e:
        logger.error(f"Error saving user history: {e}")
        return False


def get_user_history(user_id: Any) -> Dict[str, Any]:
    """Get message history for a specific user"""
    global user_history
    user_id_str = str(user_id)  # Convert to string for JSON compatibility
    
    if user_id_str not in user_history:
        user_history[user_id_str] = {
            "recent_themes": [],
            "recent_messages": []
        }
    
    return user_history[user_id_str]


def update_user_history(user_id: Any, theme: str, message: str = None) -> bool:
    """Update user history with new theme and message"""
    global user_history
    user_id_str = str(user_id)  # Convert to string for JSON compatibility
    
    user_data = get_user_history(user_id)
    
    # Update theme history (keep last 5 themes to avoid repetition)
    MAX_THEMES = 5
    if theme and theme not in user_data["recent_themes"]:
        user_data["recent_themes"].append(theme)
        if len(user_data["recent_themes"]) > MAX_THEMES:
            user_data["recent_themes"].pop(0)  # Remove oldest theme
    
    # Update message history if provided
    MAX_MESSAGES = 10
    if message:
        user_data["recent_messages"].append(message)
        if len(user_data["recent_messages"]) > MAX_MESSAGES:
            user_data["recent_messages"].pop(0)  # Remove oldest message
    
    # Save to file
    user_history[user_id_str] = user_data
    return save_user_history()


def _handle_exit(signum, frame):
    """Handle exit signals gracefully"""
    logger.info(f"Received signal {signum}, shutting down...")
    # Save subscribers
    save_subscribers()
    # Save user history
    save_user_history()
    # Save health status
    update_health_status()
    # Stop the scheduler
    if hasattr(self, 'scheduler'):
        self.scheduler.shutdown()
    # Stop the application
    if hasattr(self, 'application'):
        asyncio.run(self.application.stop())
    sys.exit(0) 
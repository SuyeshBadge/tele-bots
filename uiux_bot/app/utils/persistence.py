"""
Utility functions for data persistence (subscribers, health status).
This module provides file-based persistence by default, but defers to
the database module when Supabase is enabled.
"""

import os
import json
import time
import logging
import asyncio
import signal
import threading
import sys
from typing import Set, Dict, Any, List, Union, Optional, Callable

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
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data')
SUBSCRIBERS_FILE = os.path.join(DATA_DIR, 'subscribers.json')
USER_HISTORY_FILE = os.path.join(DATA_DIR, 'user_history.json')
HEALTH_FILE = os.path.join(DATA_DIR, 'health.json')

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

# Lock for thread-safe file operations
file_lock = threading.RLock()

def _handle_exit(signum, frame):
    """Save data on exit"""
    logger.info("Saving data before exit...")
    save_subscribers()
    save_user_history()
    save_health_status()
    sys.exit(0)

# ----------------- File-based persistence functions -----------------

def load_subscribers() -> Set[int]:
    """Load subscribers from file"""
    global subscribers
    
    with file_lock:
        if os.path.exists(SUBSCRIBERS_FILE):
            try:
                with open(SUBSCRIBERS_FILE, 'r') as f:
                    data = json.load(f)
                    subscribers = set(data)
                    logger.info(f"Loaded {len(subscribers)} subscribers")
            except Exception as e:
                logger.error(f"Failed to load subscribers: {e}")
    
    return subscribers

def save_subscribers() -> None:
    """Save subscribers to file"""
    with file_lock:
        try:
            with open(SUBSCRIBERS_FILE, 'w') as f:
                json.dump(list(subscribers), f)
                logger.debug(f"Saved {len(subscribers)} subscribers")
        except Exception as e:
            logger.error(f"Failed to save subscribers: {e}")

def add_subscriber(user_id: int) -> None:
    """Add a subscriber"""
    global subscribers
    
    with file_lock:
        subscribers.add(user_id)
        save_subscribers()
        logger.info(f"Added subscriber: {user_id}")

def remove_subscriber(user_id: int) -> None:
    """Remove a subscriber"""
    global subscribers
    
    with file_lock:
        if user_id in subscribers:
            subscribers.remove(user_id)
            save_subscribers()
            logger.info(f"Removed subscriber: {user_id}")

def get_subscribers() -> List[int]:
    """Get all subscribers"""
    global subscribers
    
    # If Supabase is enabled, try to get subscribers from there
    if settings.ENABLE_SUPABASE:
        try:
            # Import here to avoid circular imports
            from app.utils import database
            db_subscribers = database.get_subscribers()
            if db_subscribers is not None:
                return db_subscribers
        except Exception as e:
            logger.error(f"Failed to get subscribers from database: {e}")
    
    # Fallback to file-based persistence
    with file_lock:
        if not subscribers:
            load_subscribers()
        return list(subscribers)

def load_health_status() -> Dict[str, Any]:
    """Load health status from file"""
    global health_status
    
    with file_lock:
        if os.path.exists(HEALTH_FILE):
            try:
                with open(HEALTH_FILE, 'r') as f:
                    health_status = json.load(f)
                    logger.debug("Loaded health status")
            except Exception as e:
                logger.error(f"Failed to load health status: {e}")
    
    return health_status

def save_health_status() -> None:
    """Save health status to file"""
    with file_lock:
        try:
            with open(HEALTH_FILE, 'w') as f:
                json.dump(health_status, f)
                logger.debug("Saved health status")
        except Exception as e:
            logger.error(f"Failed to save health status: {e}")

def update_health_status(error: bool = False, lesson_sent: bool = False) -> None:
    """Update health status"""
    global health_status
    
    # If Supabase is enabled, try to update health status there
    if settings.ENABLE_SUPABASE:
        try:
            # Import here to avoid circular imports
            from app.utils import database
            result = database.update_health_status(error=error)
            if lesson_sent:
                database.increment_lessons_sent()
            return
        except Exception as e:
            logger.error(f"Error updating health status via Supabase: {e}")
    
    # Fallback to file-based persistence
    with file_lock:
        health_status["last_activity"] = int(time.time())
        
        if error:
            health_status["errors"] += 1
            
        if lesson_sent:
            health_status["lessons_sent"] += 1
            
        save_health_status()
        logger.debug("Updated health status")

def get_health_status() -> Dict[str, Any]:
    """Get health status"""
    # If Supabase is enabled, try to get health status from there
    if settings.ENABLE_SUPABASE:
        try:
            # Import here to avoid circular imports
            from app.utils import database
            db_health = database.get_health_status()
            if db_health is not None:
                return db_health
        except Exception as e:
            logger.error(f"Failed to get health status from database: {e}")
    
    # Fallback to file-based persistence
    with file_lock:
        if not health_status:
            load_health_status()
        return dict(health_status)

def load_user_history() -> Dict[str, Dict[str, Any]]:
    """Load user history from file"""
    global user_history
    
    with file_lock:
        if os.path.exists(USER_HISTORY_FILE):
            try:
                with open(USER_HISTORY_FILE, 'r') as f:
                    user_history = json.load(f)
                    logger.debug(f"Loaded history for {len(user_history)} users")
            except Exception as e:
                logger.error(f"Failed to load user history: {e}")
    
    return user_history

def save_user_history() -> None:
    """Save user history to file"""
    with file_lock:
        try:
            with open(USER_HISTORY_FILE, 'w') as f:
                json.dump(user_history, f)
                logger.debug(f"Saved history for {len(user_history)} users")
        except Exception as e:
            logger.error(f"Failed to save user history: {e}")

def get_user_history(user_id: Union[int, str]) -> Dict[str, Any]:
    """Get user history"""
    # If Supabase is enabled, try to get user history from there
    if settings.ENABLE_SUPABASE:
        try:
            # Import here to avoid circular imports
            from app.utils import database
            db_history = database.get_user_history(user_id)
            if db_history is not None:
                return db_history
        except Exception as e:
            logger.error(f"Failed to get user history from database: {e}")
    
    # Fallback to file-based persistence
    user_id_str = str(user_id)
    
    with file_lock:
        if not user_history:
            load_user_history()
            
        if user_id_str not in user_history:
            user_history[user_id_str] = {"recent_themes": [], "recent_lessons": []}
            
        return dict(user_history[user_id_str])

def update_user_history(user_id: Union[int, str], theme: str, message: str = "") -> None:
    """Update user history with theme and message"""
    # If Supabase is enabled, try to update user history there
    if settings.ENABLE_SUPABASE:
        try:
            # Import here to avoid circular imports
            from app.utils import database
            result = database.update_user_history(user_id, theme, message)
            if result:
                return
        except Exception as e:
            logger.error(f"Failed to update user history in database: {e}")
    
    # Fallback to file-based persistence
    user_id_str = str(user_id)
    
    with file_lock:
        # Ensure user history is loaded
        if not user_history:
            load_user_history()
            
        # Initialize if not exists
        if user_id_str not in user_history:
            user_history[user_id_str] = {"recent_themes": [], "recent_lessons": []}
            
        # Update recent themes (keep only the last 10)
        if theme in user_history[user_id_str]["recent_themes"]:
            user_history[user_id_str]["recent_themes"].remove(theme)
            
        user_history[user_id_str]["recent_themes"].insert(0, theme)
        user_history[user_id_str]["recent_themes"] = user_history[user_id_str]["recent_themes"][:10]
        
        # Update recent lessons (keep only the last 5)
        if message:
            user_history[user_id_str]["recent_lessons"].insert(0, message)
            user_history[user_id_str]["recent_lessons"] = user_history[user_id_str]["recent_lessons"][:5]
            
        # Save to file
        save_user_history()
        logger.debug(f"Updated history for user: {user_id}")

# Register signal handlers
signal.signal(signal.SIGINT, _handle_exit)
signal.signal(signal.SIGTERM, _handle_exit)

# Load data on module import
load_subscribers()
load_user_history()
get_health_status()  # Load health status 
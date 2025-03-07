"""
Supabase database client and utilities for UI/UX Bot.
"""

import logging
import time
import json
import threading
import queue
import concurrent.futures
from datetime import datetime
from typing import Dict, List, Any, Optional, Union, Callable, TypeVar, Awaitable

from supabase import create_client, Client

from app.config import settings

# Configure logger
logger = logging.getLogger(__name__)

# Initialize Supabase client (only when enabled)
_supabase_client: Optional[Client] = None
_client_lock = threading.Lock()

# Type variables for generic functions
T = TypeVar('T')

def get_supabase() -> Optional[Client]:
    """Get or initialize the Supabase client."""
    global _supabase_client
    
    if not settings.ENABLE_SUPABASE:
        return None
    
    # Use a lock to prevent multiple threads from initializing at once    
    with _client_lock:
        if _supabase_client is None:
            try:
                url = settings.SUPABASE_URL
                key = settings.SUPABASE_KEY
                
                if not url or not key:
                    logger.error("Supabase URL or key missing. Database operations will fail.")
                    return None
                    
                _supabase_client = create_client(url, key)
                logger.info("Supabase client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client: {e}")
                return None
            
    return _supabase_client

def run_in_thread(func: Callable[..., T], *args, **kwargs) -> Optional[T]:
    """
    Run a function in a separate thread with a timeout.
    
    Args:
        func: The function to run
        *args, **kwargs: Arguments to pass to the function
        
    Returns:
        The result of the function or None if it times out
    """
    result_queue: queue.Queue = queue.Queue()
    
    def worker():
        try:
            result = func(*args, **kwargs)
            result_queue.put(result)
        except Exception as e:
            logger.error(f"Error in thread worker: {e}")
            result_queue.put(None)
    
    thread = threading.Thread(target=worker)
    thread.daemon = True
    thread.start()
    
    try:
        return result_queue.get(timeout=10.0)  # Wait up to 10 seconds
    except queue.Empty:
        logger.error(f"Operation timed out: {func.__name__}")
        return None

def threadsafe_supabase_operation(fallback_func: Optional[Callable] = None):
    """
    Decorator to make Supabase operations thread-safe by running them in a separate thread.
    Falls back to the provided fallback function if Supabase is not enabled or the operation fails.
    
    Args:
        fallback_func: Function to call as fallback if Supabase operation fails
        
    Returns:
        Decorated function
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            client = get_supabase()
            
            if not client:
                if fallback_func:
                    logger.debug(f"Supabase not available, using fallback for {func.__name__}")
                    return fallback_func(*args, **kwargs)
                return None
                
            try:
                # Run the operation in a separate thread to avoid event loop conflicts
                result = run_in_thread(func, client, *args, **kwargs)
                if result is not None:
                    return result
                    
                # If we got None due to error or timeout, try fallback
                if fallback_func:
                    logger.warning(f"Supabase operation failed, using fallback for {func.__name__}")
                    return fallback_func(*args, **kwargs)
                return None
            except Exception as e:
                logger.error(f"Error in Supabase operation {func.__name__}: {e}")
                if fallback_func:
                    return fallback_func(*args, **kwargs)
                return None
        return wrapper
    return decorator

# --------------- Subscriber Management ---------------

@threadsafe_supabase_operation()
def get_subscribers(client: Client) -> List[int]:
    """Get all subscriber IDs from the database."""
    try:
        response = client.table('subscribers').select('user_id').execute()
        subscribers = [record['user_id'] for record in response.data]
        logger.info(f"Retrieved {len(subscribers)} subscribers from Supabase")
        return subscribers
    except Exception as e:
        logger.error(f"Error retrieving subscribers from Supabase: {e}")
        raise  # Let the decorator handle fallback

@threadsafe_supabase_operation()
def add_subscriber(client: Client, user_id: int) -> bool:
    """Add a subscriber to the database."""
    try:
        # Check if subscriber already exists
        response = client.table('subscribers').select('*').eq('user_id', user_id).execute()
        
        if response.data:
            # Update last_active if subscriber exists
            client.table('subscribers').update({
                'last_active': datetime.now().isoformat()
            }).eq('user_id', user_id).execute()
            logger.info(f"Updated existing subscriber: {user_id}")
            return True
            
        # Add new subscriber
        client.table('subscribers').insert({
            'user_id': user_id,
            'joined_at': datetime.now().isoformat(),
            'last_active': datetime.now().isoformat()
        }).execute()
        logger.info(f"Added new subscriber: {user_id}")
        return True
    except Exception as e:
        logger.error(f"Error adding subscriber to Supabase: {e}")
        raise  # Let the decorator handle fallback

@threadsafe_supabase_operation()
def remove_subscriber(client: Client, user_id: int) -> bool:
    """Remove a subscriber from the database."""
    try:
        client.table('subscribers').delete().eq('user_id', user_id).execute()
        logger.info(f"Removed subscriber: {user_id}")
        return True
    except Exception as e:
        logger.error(f"Error removing subscriber from Supabase: {e}")
        raise  # Let the decorator handle fallback

# --------------- Lesson Management ---------------

@threadsafe_supabase_operation()
def cache_lesson(client: Client, theme: str, lesson_data: Dict[str, Any]) -> bool:
    """Cache a lesson in the database."""
    try:
        # Ensure content is serializable
        content = lesson_data.get('content', [])
        if isinstance(content, str):
            try:
                # Try to parse as JSON if it's a string
                content = json.loads(content)
            except json.JSONDecodeError:
                # If not valid JSON, treat as a single message
                content = [content]
        
        # Store the complete lesson data
        client.table('lessons').insert({
            'theme': theme.lower(),
            'title': lesson_data.get('title', ''),
            'content': json.dumps(content),
            'quiz_question': lesson_data.get('quiz_question', ''),
            'quiz_options': json.dumps(lesson_data.get('quiz_options', [])),
            'correct_option_index': lesson_data.get('correct_option_index', 0),
            'explanation': lesson_data.get('explanation', ''),
            'option_explanations': json.dumps(lesson_data.get('option_explanations', [])),
            'created_at': datetime.now().isoformat()
        }).execute()
        logger.info(f"Cached lesson for theme: {theme}")
        return True
    except Exception as e:
        logger.error(f"Error caching lesson in Supabase: {e}")
        raise  # Let the decorator handle fallback

@threadsafe_supabase_operation()
def get_cached_lesson(client: Client, theme: str) -> Optional[Dict[str, Any]]:
    """Get a cached lesson from the database."""
    try:
        response = client.table('lessons').select('*').eq('theme', theme.lower()).order('created_at', desc=True).limit(1).execute()
        
        if not response.data:
            logger.info(f"No cached lesson found for theme: {theme}")
            return None
            
        lesson = response.data[0]
        
        # Convert JSON strings back to Python objects with error handling
        try:
            content = json.loads(lesson.get('content', '[]'))
        except json.JSONDecodeError:
            content = []
            
        try:
            quiz_options = json.loads(lesson.get('quiz_options', '[]'))
        except json.JSONDecodeError:
            quiz_options = []
            
        try:
            option_explanations = json.loads(lesson.get('option_explanations', '[]'))
        except json.JSONDecodeError:
            option_explanations = []
        
        result = {
            'title': lesson.get('title', ''),
            'content': content,
            'quiz_question': lesson.get('quiz_question', ''),
            'quiz_options': quiz_options,
            'correct_option_index': lesson.get('correct_option_index', 0),
            'explanation': lesson.get('explanation', ''),
            'option_explanations': option_explanations,
        }
        
        logger.info(f"Retrieved cached lesson for theme: {theme}")
        return result
    except Exception as e:
        logger.error(f"Error retrieving cached lesson from Supabase: {e}")
        raise  # Let the decorator handle fallback

# --------------- User History Management ---------------

@threadsafe_supabase_operation()
def get_user_history(client: Client, user_id: Union[int, str]) -> Dict[str, Any]:
    """Get user history from the database."""
    try:
        response = client.table('user_history').select('*').eq('user_id', str(user_id)).execute()
        
        if not response.data:
            # Return default history if no records found
            return {"recent_themes": [], "recent_lessons": []}
            
        history = response.data[0]
        
        # Convert JSON strings back to Python objects with error handling
        try:
            recent_themes = json.loads(history.get('recent_themes', '[]'))
        except json.JSONDecodeError:
            recent_themes = []
            
        try:
            recent_lessons = json.loads(history.get('recent_lessons', '[]'))
        except json.JSONDecodeError:
            recent_lessons = []
        
        result = {
            'recent_themes': recent_themes,
            'recent_lessons': recent_lessons,
        }
        
        logger.info(f"Retrieved history for user: {user_id}")
        return result
    except Exception as e:
        logger.error(f"Error retrieving user history from Supabase: {e}")
        raise  # Let the decorator handle fallback

@threadsafe_supabase_operation()
def update_user_history(client: Client, user_id: Union[int, str], theme: str, lesson_summary: str) -> bool:
    """Update user history in the database."""
    try:
        # Get existing history directly from Supabase
        response = client.table('user_history').select('*').eq('user_id', str(user_id)).execute()
        
        if response.data:
            history = response.data[0]
            try:
                recent_themes = json.loads(history.get('recent_themes', '[]'))
            except json.JSONDecodeError:
                recent_themes = []
                
            try:
                recent_lessons = json.loads(history.get('recent_lessons', '[]'))
            except json.JSONDecodeError:
                recent_lessons = []
        else:
            recent_themes = []
            recent_lessons = []
        
        # Update recent themes (keep only the last 10)
        if theme in recent_themes:
            recent_themes.remove(theme)
        recent_themes.insert(0, theme)
        recent_themes = recent_themes[:10]
        
        # Update recent lessons (keep only the last 5)
        recent_lessons.insert(0, lesson_summary)
        recent_lessons = recent_lessons[:5]
        
        # Check if user history exists
        if response.data:
            # Update existing history
            client.table('user_history').update({
                'recent_themes': json.dumps(recent_themes),
                'recent_lessons': json.dumps(recent_lessons),
                'updated_at': datetime.now().isoformat()
            }).eq('user_id', str(user_id)).execute()
        else:
            # Create new history
            client.table('user_history').insert({
                'user_id': str(user_id),
                'recent_themes': json.dumps(recent_themes),
                'recent_lessons': json.dumps(recent_lessons),
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }).execute()
        
        logger.info(f"Updated history for user: {user_id}")
        return True
    except Exception as e:
        logger.error(f"Error updating user history in Supabase: {e}")
        raise  # Let the decorator handle fallback

# --------------- Health Status Management ---------------

@threadsafe_supabase_operation()
def update_health_status(client: Client, error: bool = False) -> None:
    """Update bot health status in the database."""
    try:
        # Get current health status
        response = client.table('health_status').select('*').limit(1).execute()
        
        if response.data:
            # Update existing health status
            status = response.data[0]
            current_time = int(time.time())
            
            client.table('health_status').update({
                'last_activity': current_time,
                'errors': status.get('errors', 0) + (1 if error else 0)
            }).eq('id', status.get('id')).execute()
            
            logger.info("Updated health status")
        else:
            # Insert new health status
            current_time = int(time.time())
            client.table('health_status').insert({
                'start_time': current_time,
                'last_activity': current_time,
                'lessons_sent': 0,
                'errors': 1 if error else 0
            }).execute()
            
            logger.info("Inserted health status")
    except Exception as e:
        logger.error(f"Error updating health status in Supabase: {e}")
        raise  # Let the decorator handle fallback

@threadsafe_supabase_operation()
def get_health_status(client: Client) -> Dict[str, Any]:
    """Get bot health status from the database."""
    try:
        response = client.table('health_status').select('*').limit(1).execute()
        
        if not response.data:
            # Return default health status
            current_time = int(time.time())
            return {
                "start_time": current_time,
                "last_activity": current_time,
                "lessons_sent": 0,
                "errors": 0
            }
            
        status = response.data[0]
        
        result = {
            "start_time": status.get('start_time', int(time.time())),
            "last_activity": status.get('last_activity', int(time.time())),
            "lessons_sent": status.get('lessons_sent', 0),
            "errors": status.get('errors', 0)
        }
        
        logger.info("Retrieved health status")
        return result
    except Exception as e:
        logger.error(f"Error retrieving health status from Supabase: {e}")
        raise  # Let the decorator handle fallback

@threadsafe_supabase_operation()
def increment_lessons_sent(client: Client) -> None:
    """Increment the lessons sent counter in the database."""
    try:
        # Get current health status
        response = client.table('health_status').select('*').limit(1).execute()
        
        if response.data:
            # Update existing health status
            status = response.data[0]
            
            client.table('health_status').update({
                'lessons_sent': status.get('lessons_sent', 0) + 1,
                'last_activity': int(time.time())
            }).eq('id', status.get('id')).execute()
            
            logger.info("Incremented lessons sent counter")
        else:
            # Insert new health status with 1 lesson sent
            current_time = int(time.time())
            client.table('health_status').insert({
                'start_time': current_time,
                'last_activity': current_time,
                'lessons_sent': 1,
                'errors': 0
            }).execute()
            
            logger.info("Inserted health status with 1 lesson sent")
    except Exception as e:
        logger.error(f"Error incrementing lessons sent in Supabase: {e}")
        raise  # Let the decorator handle fallback 
"""
Scheduler for sending lessons at specific times.
"""

import logging
import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Callable, Coroutine, Optional

from app.config import settings
from app.utils import persistence

# Configure logger
logger = logging.getLogger(__name__)

class Scheduler:
    """Scheduler for sending lessons at specific times."""
    
    def __init__(self, send_lesson_func: Callable[[List[int], str], Coroutine[Any, Any, None]]):
        """
        Initialize the scheduler.
        
        Args:
            send_lesson_func: Function to call to send a lesson
        """
        self.send_lesson_func = send_lesson_func
        self.running = False
        self.task: Optional[asyncio.Task] = None
        
        # Schedule configuration
        self.schedule = [
            {"hour": 10, "minute": 0},  # 10:00 AM
            {"hour": 18, "minute": 0}   # 6:00 PM
        ]
        
        # Themes to cycle through
        self.themes = [
            "color theory",
            "typography",
            "layout principles",
            "user research",
            "wireframing",
            "prototyping",
            "usability testing",
            "accessibility",
            "responsive design",
            "mobile design patterns",
            "design systems",
            "information architecture",
            "visual hierarchy",
            "interaction design",
            "user personas",
            "user journey mapping",
            "microinteractions",
            "animation principles",
            "dark mode design",
            "design ethics"
        ]
        
        # Index to keep track of which theme to use next
        self.theme_index = 0
        
        # Health check interval (5 minutes)
        self.health_check_interval = 5 * 60
        
        # Last health check time
        self.last_health_check = time.time()
        
        # Set up health check function
        self.health_check_func = lambda: persistence.update_health_status()
    
    async def _scheduler_loop(self):
        """Main scheduler loop."""
        logger.info("Scheduler started")
        
        while self.running:
            try:
                # Get current time
                now = datetime.now()
                
                # Check if it's time to send a lesson
                for schedule in self.schedule:
                    if now.hour == schedule["hour"] and now.minute == schedule["minute"]:
                        # Get subscribers
                        subscribers = persistence.get_subscribers()
                        
                        if subscribers:
                            # Get next theme
                            theme = self.themes[self.theme_index]
                            self.theme_index = (self.theme_index + 1) % len(self.themes)
                            
                            # Send lesson
                            logger.info(f"Sending scheduled lesson on '{theme}' to {len(subscribers)} subscribers")
                            await self.send_lesson_func(subscribers, theme)
                            
                            # Sleep to avoid sending multiple lessons in the same minute
                            await asyncio.sleep(60)
                
                # Health check
                if time.time() - self.last_health_check > self.health_check_interval:
                    self.health_check_func()
                    self.last_health_check = time.time()
                
                # Sleep for 30 seconds before checking again
                await asyncio.sleep(30)
            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}")
                await asyncio.sleep(60)  # Sleep for a minute before trying again
    
    def start(self):
        """Start the scheduler."""
        if not self.running:
            self.running = True
            # Get the current event loop or create a new one if needed
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                # No running event loop, create a new one
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            # Create the task in the current event loop
            self.task = loop.create_task(self._scheduler_loop())
            logger.info("Scheduler task created")
    
    def stop(self):
        """Stop the scheduler."""
        if self.running:
            self.running = False
            if self.task:
                self.task.cancel()
            logger.info("Scheduler stopped") 
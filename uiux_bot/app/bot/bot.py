"""
Main bot class for the UI/UX Lesson Bot.
"""

import logging
import signal
import sys
import asyncio

from telegram.ext import (
    Application,
    CommandHandler,
    CallbackContext,
)

from app.config import settings
from app.api import unsplash_client
from app.api import image_manager
from app.utils import persistence
from app.bot import handlers, scheduler

# Configure logger
logger = logging.getLogger(__name__)


class UIUXLessonBot:
    """Main bot class for UI/UX Lessons"""

    def __init__(self):
        """Initialize the bot with all required components"""
        # Validate required environment variables
        settings.validate_settings()
        
        # Initialize bot components
        self.application = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).build()
        self.bot = self.application.bot
        
        # Initialize scheduler
        self.scheduler = scheduler.LessonScheduler(self.bot)
        
        # Setup handlers and initial data
        self.setup_handlers()
        persistence.load_subscribers()
        
        # Initialize image sources
        unsplash_client.ensure_fallback_images()
        
        # Log available image sources
        self._log_image_sources()
        
        self.setup_signal_handlers()
        
        # Update admin users if auto-admin is enabled
        if settings.AUTO_ADMIN_SUBSCRIBERS:
            self.update_admin_users()
        
        # Initialize health check
        persistence.update_health_status()
        
        # Track if the bot is shutting down
        self.is_shutting_down = False

    def setup_signal_handlers(self):
        """Set up signal handlers for graceful shutdown"""
        # Handle termination signals
        for sig in (signal.SIGTERM, signal.SIGINT):
            signal.signal(sig, self._handle_exit)
            
    def _handle_exit(self, signum, frame):
        """Handle exit signals gracefully"""
        logger.info(f"Received signal {signum}, shutting down...")
        # Save subscribers
        persistence.save_subscribers()
        # Save health status
        persistence.update_health_status()
        # Stop the scheduler
        if hasattr(self, 'scheduler'):
            self.scheduler.shutdown()
        # Stop the application
        if hasattr(self, 'application'):
            asyncio.run(self.application.stop())
        sys.exit(0)

    def setup_handlers(self):
        """Setup command handlers for the bot"""
        # Command handlers
        self.application.add_handler(CommandHandler("start", handlers.start_command))
        self.application.add_handler(CommandHandler("stop", handlers.stop_command))
        self.application.add_handler(CommandHandler("nextlesson", handlers.next_lesson_command))
        self.application.add_handler(CommandHandler("help", handlers.help_command))
        self.application.add_handler(CommandHandler("health", handlers.health_command))
        
        # Admin commands
        self.application.add_handler(CommandHandler("stats", handlers.stats_command))
        self.application.add_handler(CommandHandler("broadcast", handlers.broadcast_command))
        
        # Error handler
        self.application.add_error_handler(handlers.error_handler)

    def update_admin_users(self):
        """Update admin users list with current subscribers if auto-admin is enabled"""
        if settings.AUTO_ADMIN_SUBSCRIBERS:
            subscribers = persistence.get_subscribers()
            if subscribers:
                # Take the most recent subscriber (assuming it's the last one added)
                # This is a simplification - in a real system you might want more sophisticated logic
                latest_subscriber = list(subscribers)[-1] if subscribers else None
                
                if latest_subscriber and latest_subscriber not in settings.ADMIN_USER_IDS:
                    settings.ADMIN_USER_IDS.append(latest_subscriber)
                    logger.info(f"Added subscriber {latest_subscriber} as admin")

    def shutdown(self):
        """Properly shutdown the bot and clean up resources"""
        if self.is_shutting_down:
            return
            
        self.is_shutting_down = True
        logger.info("Bot shutdown initiated")
        
        try:
            # Save subscribers
            persistence.save_subscribers()
            
            # Update health status
            persistence.update_health_status()
            
            # Stop scheduler if it's running
            if hasattr(self, 'scheduler'):
                self.scheduler.shutdown()
            
            # Stop the application
            loop = asyncio.get_event_loop()
            if not loop.is_closed():
                try:
                    # Create a future to stop the application
                    future = asyncio.ensure_future(self.application.stop())
                    # Wait for the future with a timeout
                    loop.run_until_complete(asyncio.wait_for(future, timeout=5.0))
                except (asyncio.TimeoutError, asyncio.CancelledError):
                    logger.warning("Application stop timed out or was cancelled")
        except Exception as e:
            logger.error(f"Error during shutdown: {e}")
        finally:
            logger.info("Bot shutdown complete")

    def start(self):
        """Start the bot and scheduler"""
        try:
            # Log startup
            logger.info(f"Starting UI/UX Lesson Bot with OpenAI model: {settings.OPENAI_MODEL}")
            if settings.CHANNEL_ID:
                logger.info(f"Running in channel mode, posting to: {settings.CHANNEL_ID}")
            else:
                logger.info(f"Running in subscription mode with {len(persistence.get_subscribers())} subscribers")
            
            # Update admin users if auto-admin is enabled
            if settings.AUTO_ADMIN_SUBSCRIBERS:
                self.update_admin_users()
                logger.info(f"Auto-admin mode enabled, current admins: {settings.ADMIN_USER_IDS}")
            
            # Start the scheduler
            self.scheduler.start()
            
            # Schedule the jobs
            self.scheduler.schedule_jobs()
            
            # Start the bot
            self.application.run_polling()
            logger.info("Bot started and polling for updates")
            
        except Exception as e:
            logger.critical(f"Failed to start bot: {e}")
            raise
        finally:
            # If we reach here through an exception, make sure to shutdown cleanly
            if not self.is_shutting_down:
                self.shutdown()

    def _log_image_sources(self):
        """Log available image sources for debugging"""
        sources = []
        if getattr(settings, "ENABLE_DALLE_IMAGES", False) and settings.OPENAI_API_KEY:
            sources.append("DALL-E")
        if settings.UNSPLASH_API_KEY:
            sources.append("Unsplash")
        if getattr(settings, "PEXELS_API_KEY", None):
            sources.append("Pexels")
        sources.append("Local Fallback")
        
        logger.info(f"Available image sources: {', '.join(sources)}")
        
        # Parse image preference order
        if hasattr(settings, "IMAGE_PREFERENCE"):
            try:
                preferences = settings.IMAGE_PREFERENCE.split(',')
                logger.info(f"Image source preference order: {', '.join(preferences)}")
            except:
                logger.warning("Failed to parse IMAGE_PREFERENCE setting") 
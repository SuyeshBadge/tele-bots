"""
Main bot class for the UI/UX Lesson Bot.
"""

import logging
import signal
import sys
import asyncio
from typing import List

from telegram.constants import ParseMode
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackContext,
    PollAnswerHandler,
    Defaults,
)

from app.config import settings
from app.api import unsplash_client
from app.api import image_manager
from app.utils import persistence
from app.utils.telegram_utils import get_telegram_request
from app.bot import handlers
from app.bot.scheduler import Scheduler

# Configure logger
logger = logging.getLogger(__name__)


class UIUXLessonBot:
    """Main bot class for UI/UX Lessons"""

    def __init__(self):
        """Initialize the bot with all required components"""
        # Validate required environment variables
        settings.validate_settings()
        
        # Performance optimization: Configure application with optimized settings
        app_config = {
            "connection_pool_size": 8,  # Increase connection pool for better parallelism
            "connect_timeout": 10.0,    # Shorter connect timeout
            "read_timeout": 10.0,       # Shorter read timeout
            "write_timeout": 10.0,      # Shorter write timeout
            "pool_timeout": 1.0,        # Shorter pool timeout
        }
        
        # Initialize bot components with optimized settings
        self.application = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).defaults(defaults=Defaults(
            parse_mode=ParseMode.HTML,  # Default parse mode to HTML
            disable_notification=False,
            disable_web_page_preview=True,  # Disable web previews for faster messages
            allow_sending_without_reply=True,
            block=False  # Non-blocking by default
        )).request(get_telegram_request()).concurrent_updates(8).application_class(Application).build()  # Enable concurrent updates

        self.bot = self.application.bot
        
        # Setup handlers and initial data - load data more efficiently
        self.setup_handlers()
        persistence.load_subscribers()
        
        # Initialize scheduler with the send_scheduled_lesson function
        self.scheduler = Scheduler(self.send_scheduled_lesson)
        
        # Initialize image sources in the background if needed
        if settings.UNSPLASH_API_KEY:
            unsplash_client.ensure_fallback_images()
        
        # Log available image sources
        self._log_image_sources()
        
        self.setup_signal_handlers()
        
        # Update admin users if auto-admin is enabled
        if settings.AUTO_ADMIN_SUBSCRIBERS:
            self.update_admin_users()
        
        # Initialize health check
        persistence.update_health_status()
        
        # Shutdown flag to prevent multiple shutdown attempts
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
            self.scheduler.stop()
        # Stop the application
        if hasattr(self, 'application'):
            asyncio.create_task(self.application.stop())
        sys.exit(0)

    async def send_scheduled_lesson(self, subscribers: List[int], theme: str):
        """Send a scheduled lesson to all subscribers"""
        logger.info(f"Sending scheduled lesson on '{theme}' to {len(subscribers)} subscribers")
        
        if settings.CHANNEL_ID:
            # Channel mode: send to channel instead of individual subscribers
            try:
                await handlers.send_lesson(None, None, theme, channel_id=settings.CHANNEL_ID)
                logger.info(f"Scheduled lesson sent to channel {settings.CHANNEL_ID}")
                persistence.update_health_status(lesson_sent=True)
            except Exception as e:
                logger.error(f"Error sending scheduled lesson to channel: {e}")
                persistence.update_health_status(error=True)
        else:
            # Subscription mode: send to all subscribers
            failed_subscribers = []
            success_count = 0
            
            for user_id in subscribers:
                try:
                    await handlers.send_lesson(None, None, theme, user_id=user_id)
                    success_count += 1
                except Exception as e:
                    logger.error(f"Failed to send lesson to {user_id}: {e}")
                    failed_subscribers.append(user_id)
            
            logger.info(f"Scheduled lesson sent to {success_count}/{len(subscribers)} subscribers")
            
            # Remove failed subscribers if they're no longer valid
            for user_id in failed_subscribers:
                try:
                    # Check if user is still valid
                    await self.bot.get_chat(user_id)
                except Exception:
                    persistence.remove_subscriber(user_id)
                    logger.info(f"Removed invalid subscriber: {user_id}")
            
            if success_count > 0:
                persistence.update_health_status(lesson_sent=True)

    def setup_handlers(self):
        """Set up command handlers with optimized settings"""
        # Add command handlers
        self.application.add_handler(CommandHandler("start", handlers.start_command))
        self.application.add_handler(CommandHandler("stop", handlers.stop_command))
        self.application.add_handler(CommandHandler("help", handlers.help_command))
        self.application.add_handler(CommandHandler("nextlesson", handlers.next_lesson_command))
        self.application.add_handler(CommandHandler("health", handlers.health_command))
        
        # Add poll answer handler
        self.application.add_handler(PollAnswerHandler(handlers.on_poll_answer))
        
        # Add error handler
        self.application.add_error_handler(handlers.error_handler)
        
        # Add admin commands if enabled
        if settings.ENABLE_ADMIN_COMMANDS:
            self.application.add_handler(CommandHandler("broadcast", handlers.broadcast_command, filters=handlers.admin_filter))
            self.application.add_handler(CommandHandler("stats", handlers.stats_command, filters=handlers.admin_filter))
            self.application.add_handler(CommandHandler("subscribers", handlers.subscribers_command, filters=handlers.admin_filter))
            self.application.add_handler(CommandHandler("theme", handlers.theme_command, filters=handlers.admin_filter))
            logger.info("Admin commands enabled")

    def update_admin_users(self):
        """Update admin users list from subscribers if auto-admin is enabled"""
        if settings.AUTO_ADMIN_SUBSCRIBERS:
            subscribers = persistence.get_subscribers()
            for user_id in subscribers:
                if user_id not in settings.ADMIN_USER_IDS:
                    settings.ADMIN_USER_IDS.append(user_id)
            logger.info(f"Updated admin users: {settings.ADMIN_USER_IDS}")

    def shutdown(self):
        """Shutdown the bot and scheduler gracefully"""
        if self.is_shutting_down:
            return
            
        self.is_shutting_down = True
        logger.info("Shutting down bot...")
        
        try:
            # Stop the scheduler
            if hasattr(self, 'scheduler'):
                self.scheduler.stop()
                logger.info("Scheduler stopped")
            
            # Stop the application
            if hasattr(self, 'application'):
                try:
                    # Create a task to stop the application
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        loop.create_task(self.application.stop())
                        logger.info("Application stop task created")
                    else:
                        # If the loop is not running, run the stop coroutine directly
                        loop.run_until_complete(self.application.stop())
                        logger.info("Application stopped")
                except (asyncio.TimeoutError, asyncio.CancelledError):
                    logger.warning("Application stop timed out or was cancelled")
                except RuntimeError as e:
                    # Handle case where event loop is already closed
                    logger.warning(f"Runtime error during shutdown: {e}")
        except Exception as e:
            logger.error(f"Error during shutdown: {e}")
        finally:
            logger.info("Bot shutdown complete")

    def start(self):
        """Start the bot with polling"""
        try:
            # Log startup info
            logger.info(f"Starting UI/UX Lesson Bot with OpenAI model: {settings.OPENAI_MODEL}")
            
            # Log mode info
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
            
            # Start the bot with optimized polling
            self.application.run_polling(
                poll_interval=0.5,       # Faster polling interval
                timeout=10,              # Shorter timeout
                bootstrap_retries=5,     # Fewer bootstrap retries
                read_timeout=7,          # Shorter read timeout
                write_timeout=5,         # Shorter write timeout
                drop_pending_updates=True  # Start fresh on startup for better performance
            )
        except Exception as e:
            logger.critical(f"Failed to start bot: {e}")
            self.shutdown()
            raise

    async def start_async(self):
        """Start the bot asynchronously"""
        try:
            # Log startup info
            logger.info(f"Starting UI/UX Lesson Bot with OpenAI model: {settings.OPENAI_MODEL}")
            
            # Log mode info
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
            
            # Initialize and start the application
            await self.application.initialize()
            await self.application.start()
            
            # Start polling
            await self.application.updater.start_polling(
                poll_interval=0.5,
                timeout=10,
                bootstrap_retries=5,
                read_timeout=7,
                write_timeout=5,
                drop_pending_updates=True
            )
            
            # Keep the bot running until stopped
            stop_event = asyncio.Event()
            await stop_event.wait()
        except Exception as e:
            logger.critical(f"Failed to start bot: {e}")
            await self.shutdown_async()
            raise

    async def shutdown_async(self):
        """Shutdown the bot and scheduler gracefully (async version)"""
        logger.info("Shutting down bot...")
        try:
            # Stop the scheduler
            self.scheduler.stop()
            logger.info("Scheduler stopped")
            
            # Stop the application
            try:
                await self.application.stop()
                await self.application.shutdown()
            except Exception as e:
                logger.warning(f"Runtime error during shutdown: {e}")
        except Exception as e:
            logger.error(f"Error during shutdown: {e}")
        
        logger.info("Bot shutdown complete")

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
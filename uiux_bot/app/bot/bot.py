"""
Main bot class for the UI/UX Lesson Bot.
"""

import logging
import signal
import sys

from telegram.ext import (
    Updater,
    CommandHandler,
    CallbackContext,
)

from app.config import settings
from app.api import unsplash_client
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
        self.updater = Updater(settings.TELEGRAM_BOT_TOKEN)
        self.dispatcher = self.updater.dispatcher
        self.bot = self.updater.bot
        
        # Initialize scheduler
        self.scheduler = scheduler.LessonScheduler(self.bot)
        
        # Setup handlers and initial data
        self.setup_handlers()
        persistence.load_subscribers()
        unsplash_client.ensure_fallback_images()
        self.setup_signal_handlers()
        
        # Initialize health check
        persistence.update_health_status()

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
        # Stop the updater
        if hasattr(self, 'updater'):
            self.updater.stop()
        sys.exit(0)

    def setup_handlers(self):
        """Setup command handlers for the bot"""
        # Command handlers
        self.dispatcher.add_handler(CommandHandler("start", handlers.start_command))
        self.dispatcher.add_handler(CommandHandler("stop", handlers.stop_command))
        self.dispatcher.add_handler(CommandHandler("nextlesson", handlers.next_lesson_command))
        self.dispatcher.add_handler(CommandHandler("help", handlers.help_command))
        self.dispatcher.add_handler(CommandHandler("health", handlers.health_command))
        
        # Admin commands
        self.dispatcher.add_handler(CommandHandler("stats", handlers.stats_command))
        self.dispatcher.add_handler(CommandHandler("broadcast", handlers.broadcast_command))
        
        # Error handler
        self.dispatcher.add_error_handler(handlers.error_handler)

    def start(self):
        """Start the bot and scheduler"""
        try:
            # Log startup
            logger.info(f"Starting UI/UX Lesson Bot with OpenAI model: {settings.OPENAI_MODEL}")
            if settings.CHANNEL_ID:
                logger.info(f"Running in channel mode, posting to: {settings.CHANNEL_ID}")
            else:
                logger.info(f"Running in subscription mode with {len(persistence.get_subscribers())} subscribers")
            
            # Start the scheduler
            self.scheduler.start()
            
            # Schedule the jobs
            self.scheduler.schedule_jobs()
            
            # Start the bot
            self.updater.start_polling()
            logger.info("Bot started and polling for updates")
            
            # Run the bot until Ctrl-C is pressed
            self.updater.idle()
        except Exception as e:
            logger.critical(f"Failed to start bot: {e}")
            raise
        finally:
            # Save subscribers when shutting down
            persistence.save_subscribers()
            # Update health status
            persistence.update_health_status()
            # Stop scheduler if it's running
            if hasattr(self, 'scheduler'):
                self.scheduler.shutdown()
            logger.info("Bot shutdown complete") 
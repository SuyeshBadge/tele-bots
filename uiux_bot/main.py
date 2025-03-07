#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
UI/UX Lesson Telegram Bot - Main Entry Point

This bot provides educational UI/UX lessons twice a day (10:00 and 18:00 IST).
It also includes quizzes to engage users and can generate custom images for lessons.

Run with --dev flag to enable development mode with hot reload.
"""

import sys
print("Python version:", sys.version)
print("Loading main modules...")

import os
import asyncio
import logging

print("Setting up paths...")
# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.logger import setup_logging
from app.config import settings

# Configure logging
setup_logging()
logger = logging.getLogger(__name__)

# Apply patches to fix compatibility issues
print("Applying compatibility patches...")
from app.utils.telegram_utils import apply_telegram_patches
apply_telegram_patches()

print("Importing bot module...")
from app.bot.bot import UIUXLessonBot

print("Starting bot...")

async def async_main():
    """Async main entry point for the bot"""
    try:
        # Initialize and start the bot
        bot = UIUXLessonBot()
        # Start the scheduler in the current event loop
        bot.scheduler.start()
        # Run the application with polling
        await bot.application.initialize()
        await bot.application.start()
        
        # Start polling (only once)
        await bot.application.updater.start_polling(
            poll_interval=0.5,
            timeout=10,
            bootstrap_retries=5,
            read_timeout=7,
            write_timeout=5,
            drop_pending_updates=True
        )
        
        # Keep the bot running
        try:
            # Run forever until stopped
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            pass
        finally:
            # Proper cleanup
            try:
                await bot.application.stop()
                await bot.application.shutdown()
            except RuntimeError as e:
                logger.warning(f"Error during shutdown: {e}")
    except Exception as e:
        # Log any other exceptions
        logger.critical(f"Unexpected error: {e}", exc_info=True)
        sys.exit(1)

def main():
    """Main entry point for the bot"""
    try:
        # Run the async main function
        asyncio.run(async_main())
    except KeyboardInterrupt:
        # Handle clean shutdown on keyboard interrupt
        print("KeyboardInterrupt detected. Shutting down...")
        sys.exit(0)
    except Exception as e:
        # Log any other exceptions
        logger.critical(f"Unexpected error: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main() 
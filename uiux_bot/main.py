#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
UI/UX Lesson Telegram Bot - Main Entry Point

This bot provides educational UI/UX lessons twice a day (10:00 and 18:00 IST).
It also includes quizzes to engage users and can generate custom images for lessons.
"""

import asyncio
import logging
import sys
import nest_asyncio
import signal

from app.utils.logger import setup_logging
from app.bot.bot import UIUXLessonBot


def main():
    """Main function to run the bot"""
    # Setup logging
    logger = setup_logging()
    
    # Apply nest_asyncio to allow nested event loops
    nest_asyncio.apply()
    
    # Initialize a new event loop
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    # Set up signal handlers for graceful shutdown
    bot = None
    
    def signal_handler(sig, frame):
        logger.info(f"Received signal {sig}, shutting down...")
        if bot:
            bot.shutdown()
        if loop.is_running():
            loop.stop()
        logger.info("Shutdown complete")
        sys.exit(0)
    
    # Register signal handlers
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, signal_handler)
    
    try:
        # Create and start the bot
        logger.info("Initializing UI/UX Lesson Bot")
        bot = UIUXLessonBot()
        bot.start()
    except ValueError as e:
        logger.critical(f"Configuration error: {e}")
        sys.exit(1)
    except Exception as e:
        logger.critical(f"Unexpected error: {e}")
        sys.exit(1)
    finally:
        # Clean up resources
        if loop.is_running():
            loop.stop()
        loop.close()


if __name__ == "__main__":
    main() 
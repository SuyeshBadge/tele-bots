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

from app.utils.logger import setup_logging
from app.bot.bot import UIUXLessonBot


def main():
    """Main function to run the bot"""
    # Setup logging
    logger = setup_logging()
    
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


if __name__ == "__main__":
    main() 
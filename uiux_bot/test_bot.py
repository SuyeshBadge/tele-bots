#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Simple test script to check if the bot can connect to Telegram.
"""

import os
import sys
import logging
import asyncio
from telegram import Bot
from telegram.error import TelegramError
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Apply patches to fix compatibility issues
from app.utils.telegram_utils import apply_telegram_patches
apply_telegram_patches()

# Load environment variables
load_dotenv()

# Get bot token
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

async def test_connection():
    """Test connection to Telegram API"""
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not found in environment variables")
        return False
    
    try:
        logger.info(f"Testing connection with token: {TELEGRAM_BOT_TOKEN[:5]}...{TELEGRAM_BOT_TOKEN[-5:]}")
        bot = Bot(token=TELEGRAM_BOT_TOKEN)
        me = await bot.get_me()
        logger.info(f"Successfully connected to Telegram API as {me.first_name} (@{me.username})")
        return True
    except TelegramError as e:
        logger.error(f"Failed to connect to Telegram API: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return False

async def main():
    """Main function"""
    success = await test_connection()
    if success:
        logger.info("Test completed successfully")
    else:
        logger.error("Test failed")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main()) 
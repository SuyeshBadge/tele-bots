#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Simple script to run the UI/UX Lesson Bot.
"""

import os
import sys
import logging
import asyncio
from telegram.ext import Application, CommandHandler
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

# Simple command handlers
async def start_command(update, context):
    await update.message.reply_text("Hello! I'm the UI/UX Lesson Bot. Use /help to see available commands.")

async def help_command(update, context):
    await update.message.reply_text(
        "Available commands:\n"
        "/start - Start the bot\n"
        "/help - Show this help message\n"
        "/ping - Check if the bot is running"
    )

async def ping_command(update, context):
    await update.message.reply_text("Pong! The bot is running.")

async def main():
    """Main function"""
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not found in environment variables")
        return
    
    try:
        # Create the Application
        application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
        
        # Add handlers
        application.add_handler(CommandHandler("start", start_command))
        application.add_handler(CommandHandler("help", help_command))
        application.add_handler(CommandHandler("ping", ping_command))
        
        # Start the bot
        logger.info("Starting bot...")
        await application.initialize()
        await application.start()
        await application.updater.start_polling()
        
        # Keep the bot running
        logger.info("Bot is running. Press Ctrl+C to stop.")
        await asyncio.Event().wait()
    except Exception as e:
        logger.error(f"Error running bot: {e}")
    finally:
        # Shutdown
        if 'application' in locals():
            logger.info("Shutting down...")
            await application.stop()
            await application.shutdown()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)
 
"""
Telegram bot command handlers for the UI/UX Lesson Bot.
"""

import time
import random
import logging
from datetime import datetime
from typing import Dict, Any, Optional

from telegram import Update, ParseMode, Poll
from telegram.ext import CallbackContext

from app.config import settings
from app.api import openai_client, unsplash_client
from app.utils import persistence

# Configure logger
logger = logging.getLogger(__name__)


async def start_command(update: Update, context: CallbackContext):
    """Handler for /start command - subscribe to lessons"""
    user_id = update.effective_user.id
    
    if user_id not in persistence.get_subscribers():
        persistence.add_subscriber(user_id)
        await update.message.reply_text(
            "Welcome to the UI/UX Lesson Bot! 🎨\n\n"
            "You are now subscribed to receive UI/UX lessons twice a day (10:00 AM and 6:00 PM IST).\n\n"
            "Commands:\n"
            "/nextlesson - Get a lesson right now\n"
            "/stop - Unsubscribe from lessons\n"
            "/help - Show this help message\n"
            "/health - Check bot health status"
        )
        logger.info(f"New subscriber: {user_id}")
    else:
        await update.message.reply_text(
            "You're already subscribed to UI/UX lessons! 👍\n"
            "Use /nextlesson to get a lesson right now."
        )
    
    persistence.update_health_status()


async def stop_command(update: Update, context: CallbackContext):
    """Handler for /stop command - unsubscribe from lessons"""
    user_id = update.effective_user.id
    
    if user_id in persistence.get_subscribers():
        persistence.remove_subscriber(user_id)
        await update.message.reply_text(
            "You've been unsubscribed from UI/UX lessons. 😢\n"
            "You can subscribe again anytime with /start."
        )
        logger.info(f"Subscriber removed: {user_id}")
    else:
        await update.message.reply_text(
            "You're not currently subscribed to UI/UX lessons.\n"
            "Use /start to subscribe."
        )
    
    persistence.update_health_status()


async def help_command(update: Update, context: CallbackContext):
    """Handler for /help command - show help information"""
    await update.message.reply_text(
        "🎨 *UI/UX Lesson Bot Help* 🎨\n\n"
        "This bot sends UI/UX design lessons twice daily (10 AM and 6 PM IST).\n\n"
        "*Commands:*\n"
        "/start - Subscribe to lessons\n"
        "/stop - Unsubscribe from lessons\n"
        "/nextlesson - Get a lesson immediately\n"
        "/help - Show this help message\n"
        "/health - Check bot health status\n\n"
        "Each lesson includes educational content and a quiz to test your knowledge.\n"
        "Enjoy learning about UI/UX design! 🚀",
        parse_mode=ParseMode.MARKDOWN
    )
    persistence.update_health_status()


async def health_command(update: Update, context: CallbackContext):
    """Handler for /health command - show health status"""
    health_data = persistence.get_health_status()
    uptime = int(time.time()) - health_data["start_time"]
    days, remainder = divmod(uptime, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, seconds = divmod(remainder, 60)
    
    await update.message.reply_text(
        f"🔍 *Bot Health Status*\n\n"
        f"• Uptime: {days}d {hours}h {minutes}m {seconds}s\n"
        f"• Lessons sent: {health_data['lessons_sent']}\n"
        f"• Last activity: {datetime.fromtimestamp(health_data['last_activity']).strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"• Errors: {health_data['errors']}\n"
        f"• Subscribers: {len(persistence.get_subscribers())}\n"
        f"• Bot status: Online ✅",
        parse_mode=ParseMode.MARKDOWN
    )
    persistence.update_health_status()


async def next_lesson_command(update: Update, context: CallbackContext):
    """Handler for /nextlesson command - send a lesson immediately"""
    user_id = update.effective_user.id
    
    # Implement rate limiting for non-admin users
    if user_id not in settings.ADMIN_USER_IDS:
        last_request = context.user_data.get('last_nextlesson_request', 0)
        now = time.time()
        if now - last_request < 3600:  # 1 hour cooldown
            minutes_left = int((3600 - (now - last_request)) / 60)
            await update.message.reply_text(
                f"⏳ Please wait {minutes_left} more minutes before requesting another lesson.\n"
                f"This limit helps prevent abuse and keeps costs down. Thank you for understanding!"
            )
            return
        # Set last request time
        context.user_data['last_nextlesson_request'] = now
    
    # Only subscribers can request on-demand lessons
    if user_id in persistence.get_subscribers() or user_id in settings.ADMIN_USER_IDS:
        await update.message.reply_text("Generating your UI/UX lesson, please wait...")
        try:
            await send_lesson(user_id=user_id, bot=context.bot)
            logger.info(f"On-demand lesson sent to user {user_id}")
        except Exception as e:
            logger.error(f"Error sending on-demand lesson: {e}")
            persistence.update_health_status(error=True)
            await update.message.reply_text(
                "Sorry, there was an error generating your lesson. Please try again later."
            )
    else:
        await update.message.reply_text(
            "You need to subscribe first! Use /start to subscribe to UI/UX lessons."
        )
    
    persistence.update_health_status()


async def stats_command(update: Update, context: CallbackContext):
    """Admin command to get subscriber stats"""
    user_id = update.effective_user.id
    
    if user_id in settings.ADMIN_USER_IDS:
        # Get system stats
        health_data = persistence.get_health_status()
        uptime = int(time.time()) - health_data["start_time"]
        days, remainder = divmod(uptime, 86400)
        hours, remainder = divmod(remainder, 3600)
        minutes, seconds = divmod(remainder, 60)
        
        await update.message.reply_text(
            f"📊 *Bot Statistics*\n\n"
            f"*Subscribers:*\n"
            f"• Total subscribers: {len(persistence.get_subscribers())}\n"
            f"• Last lesson time: {get_last_lesson_time()}\n\n"
            f"*System:*\n"
            f"• Uptime: {days}d {hours}h {minutes}m {seconds}s\n"
            f"• Lessons sent: {health_data['lessons_sent']}\n"
            f"• Errors: {health_data['errors']}\n\n"
            f"*Configuration:*\n"
            f"• Text model: {settings.OPENAI_MODEL}\n"
            f"• Image source: {'Unsplash API' if settings.UNSPLASH_API_KEY else 'Local fallback images'}\n"
            f"• Channel mode: {'Enabled' if settings.CHANNEL_ID else 'Disabled'}",
            parse_mode=ParseMode.MARKDOWN
        )
    else:
        await update.message.reply_text("This command is only available to admins.")
    
    persistence.update_health_status()


async def broadcast_command(update: Update, context: CallbackContext):
    """Admin command to broadcast a message to all subscribers"""
    user_id = update.effective_user.id
    
    if user_id in settings.ADMIN_USER_IDS and context.args:
        message = " ".join(context.args)
        success_count = 0
        failed_ids = []
        
        await update.message.reply_text(f"Broadcasting message to {len(persistence.get_subscribers())} subscribers...")
        
        for subscriber_id in persistence.get_subscribers():
            try:
                await context.bot.send_message(
                    chat_id=subscriber_id,
                    text=f"📣 *Announcement*\n\n{message}",
                    parse_mode=ParseMode.MARKDOWN
                )
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to send broadcast to {subscriber_id}: {e}")
                failed_ids.append(subscriber_id)
        
        # Clean up invalid subscribers
        for failed_id in failed_ids:
            persistence.remove_subscriber(failed_id)
            
        await update.message.reply_text(
            f"Broadcast results:\n"
            f"✅ Sent to {success_count} subscribers\n"
            f"❌ Failed: {len(failed_ids)} subscribers\n"
            f"🧹 Cleaned up {len(failed_ids)} invalid subscribers"
        )
    elif user_id in settings.ADMIN_USER_IDS:
        await update.message.reply_text("Usage: /broadcast [message]")
    else:
        await update.message.reply_text("This command is only available to admins.")
    
    persistence.update_health_status()


def get_last_lesson_time() -> str:
    """Get formatted time of last lesson"""
    # This would typically read from storage
    # For now, return current time as placeholder
    return datetime.now(settings.TIMEZONE).strftime("%Y-%m-%d %H:%M:%S")


async def error_handler(update: Update, context: CallbackContext):
    """Log errors caused by updates"""
    logger.error(f"Update {update} caused error: {context.error}")
    persistence.update_health_status(error=True)
    
    # If update is available and has effective message, notify user
    if update and update.effective_message:
        await update.effective_message.reply_text(
            "Sorry, something went wrong. Please try again later."
        )
    
    persistence.update_health_status()


async def send_lesson(user_id: int = None, channel_id: str = None, bot = None):
    """Send a complete lesson to a user or channel"""
    if not user_id and not channel_id:
        logger.error("No target specified for lesson")
        return
    
    if not bot:
        logger.error("Bot instance is required")
        return
    
    target_id = channel_id if channel_id else user_id
    
    # Select a random theme for the lesson
    theme = random.choice(settings.UI_UX_THEMES)
    
    # Generate lesson content
    lesson_data = await openai_client.generate_lesson_content(theme)
    
    # Format the message
    message = (
        f"🎨 *{lesson_data['title']}* 🎨\n\n"
        f"{lesson_data['content']}\n\n"
    )
    
    # Send the main lesson
    sent_message = await bot.send_message(
        chat_id=target_id,
        text=message,
        parse_mode=ParseMode.MARKDOWN
    )
    
    # Get and send an image
    image_data = await unsplash_client.get_image_for_lesson(theme)
    if image_data:
        try:
            caption = f"Illustration for: {lesson_data['title']}"
            
            # Add attribution if available
            if "attribution" in image_data and image_data["attribution"]:
                caption += f"\n{image_data['attribution']}"
            
            if "url" in image_data:
                # Send image from URL (Unsplash)
                await bot.send_photo(
                    chat_id=target_id,
                    photo=image_data["url"],
                    caption=caption
                )
            elif "file" in image_data:
                # Send local image file
                with open(image_data["file"], "rb") as photo:
                    await bot.send_photo(
                        chat_id=target_id,
                        photo=photo,
                        caption=caption
                    )
        except Exception as e:
            logger.error(f"Error sending image: {e}")
    
    # Send the quiz
    await bot.send_poll(
        chat_id=target_id,
        question=lesson_data['quiz_question'],
        options=lesson_data['quiz_options'],
        type=Poll.QUIZ,
        correct_option_id=lesson_data['correct_option_index'],
        explanation=lesson_data['explanation'],
        is_anonymous=True
    )
    
    # Update health status
    persistence.update_health_status(lesson_sent=True) 
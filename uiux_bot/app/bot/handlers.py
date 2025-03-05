"""
Telegram bot command handlers for the UI/UX Lesson Bot.
"""

import time
import random
import logging
import json
from datetime import datetime
from typing import Dict, Any, Optional

from telegram import Update, Poll
from telegram.constants import ParseMode
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
        
        # Update admin users if enabled
        if settings.AUTO_ADMIN_SUBSCRIBERS and user_id not in settings.ADMIN_USER_IDS:
            settings.ADMIN_USER_IDS.append(user_id)
            logger.info(f"Added new subscriber {user_id} as admin")
        
        await update.message.reply_text(
            "👋 *Welcome to the Professional UI/UX Design Academy* 🎨\n\n"
            "You're now subscribed to receive expert UI/UX design lessons twice daily (10:00 AM and 6:00 PM IST).\n\n"
            "*Available Commands:*\n"
            "• /nextlesson - Request an immediate lesson\n"
            "• /stop - Unsubscribe from lessons\n"
            "• /help - View all commands and information\n"
            "• /health - Check system status\n\n"
            "We're excited to help you enhance your design skills with industry-leading content.",
            parse_mode=ParseMode.MARKDOWN
        )
        logger.info(f"New subscriber: {user_id}")
    else:
        await update.message.reply_text(
            "✅ *You're already subscribed to our UI/UX lessons*\n\n"
            "Your subscription is active and you'll continue receiving professional design insights.\n\n"
            "Use /nextlesson to request an immediate lesson on demand.",
            parse_mode=ParseMode.MARKDOWN
        )
    
    persistence.update_health_status()


async def stop_command(update: Update, context: CallbackContext):
    """Handler for /stop command - unsubscribe from lessons"""
    user_id = update.effective_user.id
    
    if user_id in persistence.get_subscribers():
        persistence.remove_subscriber(user_id)
        await update.message.reply_text(
            "🔔 *Subscription Update*\n\n"
            "You've been unsubscribed from our UI/UX design lessons.\n\n"
            "We value your feedback - if you have a moment, we'd appreciate knowing why you've chosen to unsubscribe.\n\n"
            "You can reactivate your subscription anytime with the /start command.",
            parse_mode=ParseMode.MARKDOWN
        )
        logger.info(f"Subscriber removed: {user_id}")
    else:
        await update.message.reply_text(
            "ℹ️ *Subscription Status*\n\n"
            "You don't currently have an active subscription to our UI/UX lessons.\n\n"
            "Use /start to subscribe and begin receiving professional design insights.",
            parse_mode=ParseMode.MARKDOWN
        )
    
    persistence.update_health_status()


async def help_command(update: Update, context: CallbackContext):
    """Handler for /help command - show help information"""
    await update.message.reply_text(
        "🎓 *UI/UX Design Academy - Command Guide* 🎨\n\n"
        "Our service delivers professional UI/UX design lessons twice daily (10 AM and 6 PM IST).\n\n"
        "*Command Reference:*\n"
        "• /start - Activate your subscription\n"
        "• /stop - Deactivate your subscription\n"
        "• /nextlesson - Request an immediate lesson\n"
        "• /help - Display this reference guide\n"
        "• /health - View system status\n\n"
        "Each lesson includes expert educational content and an interactive quiz to reinforce your learning.\n\n"
        "Thank you for choosing our platform to develop your UI/UX design expertise.",
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
        cooldown = settings.NEXTLESSON_COOLDOWN
        if now - last_request < cooldown:
            time_left = int(cooldown - (now - last_request))
            
            # Format the time differently based on the cooldown duration
            if cooldown >= 3600:  # 1 hour or more
                minutes_left = time_left // 60
                time_msg = f"{minutes_left} minutes"
            else:
                time_msg = f"{time_left} seconds"
            
            # Different message based on deployment mode
            if settings.IS_DEV_MODE:
                mode_msg = f"[DEV MODE] Cooldown setting: {cooldown} seconds."
            else:
                mode_msg = f"This helps us maintain service quality and ensures optimal resource allocation."
                
            await update.message.reply_text(
                f"⏱️ *Request Limit Notice*\n\n"
                f"Please wait {time_msg} before requesting another lesson.\n\n"
                f"{mode_msg}",
                parse_mode=ParseMode.MARKDOWN
            )
            return
        # Set last request time
        context.user_data['last_nextlesson_request'] = now
    
    # Only subscribers can request on-demand lessons
    if user_id in persistence.get_subscribers() or user_id in settings.ADMIN_USER_IDS:
        await update.message.reply_text(
            "🔄 *Generating your design lesson*\n\n"
            "We're preparing a professional UI/UX lesson for you. This may take a moment...",
            parse_mode=ParseMode.MARKDOWN
        )
        try:
            await send_lesson(user_id=user_id, bot=context.bot)
            logger.info(f"On-demand lesson sent to user {user_id}")
        except Exception as e:
            logger.error(f"Error sending on-demand lesson: {e}")
            persistence.update_health_status(error=True)
            await update.message.reply_text(
                "⚠️ *Service Interruption*\n\n"
                "We encountered an issue while generating your lesson. Please try again later.\n\n"
                "Our team has been notified of this error.",
                parse_mode=ParseMode.MARKDOWN
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
    
    # Get lesson history for this user to avoid repetition
    user_history = persistence.get_user_history(target_id)
    recent_themes = user_history.get("recent_themes", [])
    
    # Select a theme that hasn't been used recently
    available_themes = [theme for theme in settings.UI_UX_THEMES if theme not in recent_themes]
    if not available_themes:  # If all themes have been used, reset
        available_themes = settings.UI_UX_THEMES
    
    theme = random.choice(available_themes)
    
    # Generate lesson content
    lesson_data = await openai_client.generate_lesson_content(theme)
    
    # Format the message
    message = (
        f"📚 *{lesson_data['title']}* 📚\n\n"
        f"{lesson_data['content']}\n\n"
    )
    
    # Send the main lesson
    sent_message = await bot.send_message(
        chat_id=target_id,
        text=message,
        parse_mode=ParseMode.MARKDOWN
    )
    
    # Save this lesson's content to user history 
    message_summary = {
        "title": lesson_data['title'],
        "theme": theme,
        "timestamp": int(time.time()),
        "content_summary": lesson_data['content'][:100] + "...",  # Store just a summary
        "quiz_question": lesson_data['quiz_question']
    }
    persistence.update_user_history(target_id, theme, json.dumps(message_summary))
    
    # Get and send an image
    image_data = await unsplash_client.get_image_for_lesson(theme)
    if image_data:
        try:
            caption = f"*Visual context for: {lesson_data['title']}*"
            
            # Add attribution if available
            if "attribution" in image_data and image_data["attribution"]:
                caption += f"\n{image_data['attribution']}"
            
            if "url" in image_data:
                # Send image from URL (Unsplash)
                await bot.send_photo(
                    chat_id=target_id,
                    photo=image_data["url"],
                    caption=caption,
                    parse_mode=ParseMode.MARKDOWN
                )
            elif "file" in image_data:
                # Send local image file
                with open(image_data["file"], "rb") as photo:
                    await bot.send_photo(
                        chat_id=target_id,
                        photo=photo,
                        caption=caption,
                        parse_mode=ParseMode.MARKDOWN
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
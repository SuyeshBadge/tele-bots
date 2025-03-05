"""
Telegram bot command handlers for the UI/UX Lesson Bot.
"""

import time
import random
import logging
import json
import re
from datetime import datetime
from typing import Dict, Any, Optional

from telegram import Update, Poll
from telegram.constants import ParseMode
from telegram.ext import CallbackContext

from app.config import settings
from app.api import openai_client
from app.api import image_manager
from app.utils import persistence

# Configure logger
logger = logging.getLogger(__name__)


def sanitize_html_for_telegram(text: str) -> str:
    """
    Simple HTML sanitization for Telegram messages.
    Telegram supports limited HTML tags: <b>, <i>, <code>, <pre>, <a>.
    """
    if not text:
        return ""
        
    # Convert markdown-style to HTML with simple replacements
    # Process bold first (avoids issues with nested formatting)
    text = text.replace("**", "<b>", 1)
    while "**" in text:
        text = text.replace("**", "</b>", 1)
        if "**" in text:
            text = text.replace("**", "<b>", 1)
    
    # Process italics after bold
    text = text.replace("*", "<i>", 1)
    while "*" in text:
        text = text.replace("*", "</i>", 1)
        if "*" in text:
            text = text.replace("*", "<i>", 1)
    
    # Preserve and enhance paragraph formatting
    
    # First, convert all HTML breaks to consistent newlines
    text = text.replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n")
    
    # Ensure paragraphs have at least double newlines between them
    # Replace single newlines only if they're not already part of a paragraph break
    text = re.sub(r'(?<!\n)\n(?!\n)', '\n\n', text)
    
    # Make paragraph breaks consistently double newlines (not more)
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Add spacing after bullet points for better readability
    text = re.sub(r'(•|·|\*|\\-|-)(\s*)', r'\1 ', text)
    
    # Make sure each paragraph starts with proper indentation for readability
    text = re.sub(r'\n\n([^•\*\-<])', r'\n\n\1', text)
    
    return text


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
    """Display help information."""
    help_text = (
        "🔸 <b>UI/UX Lesson Bot Commands</b> 🔸\n\n"
        "/start - Subscribe to daily UI/UX lessons\n"
        "/stop - Unsubscribe from lessons\n"
        "/nextlesson - Request a new lesson immediately\n"
        "/image <theme> - Generate a UI/UX image on a specific theme\n"
        "/health - Check bot status\n"
        "/help - Show this help message\n\n"
        
        "📚 <b>About This Bot</b>\n"
        "This bot sends UI/UX design lessons twice daily (10:00 and 18:00 IST).\n"
        "Each lesson includes educational content, a quiz, and a relevant image.\n\n"
        
        "Images are provided by Unsplash, DALL-E, and other sources, with proper attribution."
    )
    
    await update.message.reply_text(help_text, parse_mode=ParseMode.HTML)


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
        # Send a temporary message that will be deleted after lesson is sent
        temp_message = await update.message.reply_text(
            "🔮✨ <b>AI DESIGN ACADEMY</b> ✨🔮\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n\n"
            "📲 <b>GENERATING PERSONALIZED LESSON</b> 📲\n\n"
            "🤖 Our advanced AI is crafting a <b>custom UI/UX masterclass</b> specifically for you!\n\n"
            "🌟 <b>WHAT YOU'LL DISCOVER:</b> 🌟\n"
            "• Industry-leading design techniques\n"
            "• Professional workflow optimization\n"
            "• Creative problem-solving approaches\n"
            "• User psychology insights\n\n"
            "⚡ <b>WHY THIS MATTERS:</b> ⚡\n"
            "• Instantly elevate your design portfolio\n"
            "• Stand out in competitive job markets\n"
            "• Create more intuitive digital experiences\n"
            "• Apply cutting-edge design principles\n\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n"
            "⏳ <b>Your personalized lesson will appear momentarily...</b> ⏳",
            parse_mode=ParseMode.HTML
        )
        try:
            await send_lesson(user_id=user_id, bot=context.bot)
            # Delete the temporary "generating" message after lesson is sent
            await temp_message.delete()
            logger.info(f"On-demand lesson sent to user {user_id}")
        except Exception as e:
            logger.error(f"Error sending on-demand lesson: {e}")
            persistence.update_health_status(error=True)
            # Don't delete the temp message if there was an error, update it instead
            await temp_message.edit_text(
                "⚠️ <b>Service Interruption</b> ⚠️\n\n"
                "We encountered an issue while generating your lesson. Please try again later.\n\n"
                "Our team has been notified of this error.",
                parse_mode=ParseMode.HTML
            )
    else:
        await update.message.reply_text(
            "⚠️ <b>Subscription Required</b> ⚠️\n\n"
            "You need to be subscribed to request lessons on demand.\n\n"
            "Subscribe using the /start command first.",
            parse_mode=ParseMode.HTML
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
    """Send a UI/UX design lesson."""
    try:
        # Get bot instance if not provided
        if not bot:
            from app.bot import get_bot
            bot = await get_bot()
        
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
        
        # Ensure lesson_data has all required fields
        required_fields = {
            'title': str,
            'content': str,
            'quiz_question': str,
            'quiz_options': list,
            'correct_option_index': int,
            'explanation': str
        }
        
        for field, expected_type in required_fields.items():
            if field not in lesson_data:
                logger.error(f"Missing required field in lesson data: {field}")
                lesson_data[field] = "" if expected_type == str else ([] if expected_type == list else 0)
            elif not isinstance(lesson_data[field], expected_type):
                logger.error(f"Field {field} has wrong type. Expected {expected_type}, got {type(lesson_data[field])}")
                if expected_type == str:
                    lesson_data[field] = str(lesson_data[field])
                elif expected_type == list and isinstance(lesson_data[field], str):
                    # Try to convert string to list if possible
                    try:
                        if lesson_data[field].startswith('[') and lesson_data[field].endswith(']'):
                            import ast
                            lesson_data[field] = ast.literal_eval(lesson_data[field])
                        else:
                            lesson_data[field] = [lesson_data[field]]
                    except:
                        lesson_data[field] = ["Option A", "Option B", "Option C", "Option D"]
                elif expected_type == int:
                    try:
                        lesson_data[field] = int(lesson_data[field])
                    except:
                        lesson_data[field] = 0

        # Get an image using the enhanced image manager
        image_data = await image_manager.get_image_for_lesson(theme)
        
        # Save this lesson's content to user history 
        message_summary = {
            "title": lesson_data['title'],
            "theme": theme,
            "timestamp": int(time.time()),
            "content_summary": lesson_data['content'][:100] + "...",  # Store just a summary
            "quiz_question": lesson_data['quiz_question']
        }
        
        # Also save image information if available
        if image_data and "url" in image_data:
            message_summary["image_url"] = image_data["url"]
            message_summary["image_source"] = image_data.get("attribution", "Unknown source")
            
            # Optionally save the image locally for future use
            if getattr(settings, "SAVE_IMAGES_LOCALLY", False) and "url" in image_data:
                try:
                    await image_manager.image_manager.save_image_locally(image_data["url"])
                except Exception as e:
                    logger.error(f"Failed to save image locally: {e}")
                
        persistence.update_user_history(target_id, theme, json.dumps(message_summary))
        
        # Ensure content is properly formatted using our sanitize function
        clean_title = lesson_data['title'].replace('*', '')  # Remove any asterisks from title
        
        # Sanitize content using our helper function
        # Make sure we have proper newlines in the content
        content = sanitize_html_for_telegram(lesson_data['content'])
        
        # Ensure paragraphs are properly separated
        if not content.startswith("\n"):
            content = "\n" + content
        
        # Format the message with enhanced styling using HTML
        message_title = f"✨ <b>{clean_title}</b> ✨\n\n"
        message_content = f"{content}\n\n"
        
        # Add a visually appealing separator
        message_content += "━━━━━━━━━━━━━━━━━━━━━━\n\n"
        
        # Add attribution if available
        attribution = ""
        if image_data and "attribution" in image_data and image_data["attribution"]:
            attribution = f"📸 <i>{image_data['attribution']}</i>\n\n"
        
        # Telegram has a caption limit of 1024 characters
        caption = message_title
        
        # If content is short enough, include it in the caption
        if len(message_title + message_content + attribution) <= 1024:
            caption = message_title + message_content + attribution
            remaining_text = None
        else:
            # Message too long, send content separately
            remaining_text = message_content + attribution
        
        if image_data:
            try:
                if "url" in image_data:
                    # Send image with caption from URL
                    await bot.send_photo(
                        chat_id=target_id,
                        photo=image_data["url"],
                        caption=caption,
                        parse_mode=ParseMode.HTML
                    )
                elif "file" in image_data:
                    # Send image with caption from file
                    with open(image_data["file"], "rb") as photo:
                        await bot.send_photo(
                            chat_id=target_id,
                            photo=photo,
                            caption=caption,
                            parse_mode=ParseMode.HTML
                        )
                
                # If there's remaining text, send it as a separate message
                if remaining_text:
                    await bot.send_message(
                        chat_id=target_id,
                        text=remaining_text,
                        parse_mode=ParseMode.HTML
                    )
            except Exception as e:
                logger.error(f"Error sending image with message: {e}")
                # Fallback to sending complete message without image
                full_message = message_title + message_content + attribution
                await bot.send_message(
                    chat_id=target_id,
                    text=full_message,
                    parse_mode=ParseMode.HTML
                )
        else:
            # No image available, send text only
            full_message = message_title + message_content
            await bot.send_message(
                chat_id=target_id,
                text=full_message,
                parse_mode=ParseMode.HTML
            )
        
        # Send the quiz
        quiz_question = lesson_data['quiz_question']
        # Strip HTML tags - Telegram poll API doesn't support HTML formatting
        quiz_question = re.sub(r'<[^>]*>', '', quiz_question)
        # Clean up any markdown formatting
        quiz_question = quiz_question.replace('**', '').replace('*', '')
        
        # Format without HTML tags since polls don't support HTML
        question = f"🧠 TEST YOUR KNOWLEDGE: 🧠\n\n{quiz_question}"
        
        if len(question) > 300:
            # Truncate the question, but keep the intro part
            intro = "🧠 TEST YOUR KNOWLEDGE: 🧠\n\n"
            remaining_length = 300 - len(intro) - 3  # 3 for the "..."
            truncated_q = quiz_question[:remaining_length] + "..."
            question = intro + truncated_q
            
        # Clean the options
        options = []
        for option in lesson_data['quiz_options']:
            # Clean option formatting - strip HTML and normalize spaces
            clean_option = option.replace("<br>", " ").replace("\n", " ")
            clean_option = re.sub(r'<[^>]*>', '', clean_option)  # Remove HTML tags
            clean_option = clean_option.replace('**', '').replace('*', '')  # Remove markdown
            
            if len(clean_option) > 100:
                clean_option = clean_option[:97] + "..."
            options.append(clean_option)
            
        # Clean explanation text too
        explanation = lesson_data['explanation'].replace("<br>", " ").replace("\n", " ")
        explanation = re.sub(r'<[^>]*>', '', explanation)  # Remove HTML tags
        explanation = explanation.replace('**', '').replace('*', '')  # Remove markdown
        if len(explanation) > 200:
            explanation = explanation[:197] + "..."
            
        try:
            await bot.send_poll(
                chat_id=target_id,
                question=question,
                options=options,
                type=Poll.QUIZ,
                correct_option_id=lesson_data['correct_option_index'],
                explanation=explanation,
                is_anonymous=True
            )
            logger.info("Quiz sent")
        except Exception as e:
            logger.error(f"Error sending poll: {e}")
            # Send as a text message instead
            poll_text = f"Quiz: {question}\n\n"
            for i, option in enumerate(options):
                poll_text += f"{i+1}. {option}\n"
            poll_text += f"\n✅ Answer: Option {lesson_data['correct_option_index'] + 1}\n\n"
            poll_text += f"💡 Explanation: {explanation}"
            
            await bot.send_message(
                chat_id=target_id,
                text=poll_text,
                parse_mode=ParseMode.HTML
            )
        
        # Update health status
        persistence.update_health_status(lesson_sent=True)
        return lesson_data
    except Exception as e:
        logger.error(f"Error sending lesson: {e}")
        return None 


async def image_command(update: Update, context: CallbackContext):
    """Generate an image related to a UI/UX theme."""
    user_id = update.effective_user.id
    
    # Check if user has permission
    if not persistence.is_subscriber(user_id) and user_id not in settings.ADMIN_USER_IDS:
        await update.message.reply_text(
            "Sorry, you need to be a subscriber to use this feature. "
            "Type /start to subscribe."
        )
        return
    
    # Check rate limits for non-admin users
    if user_id not in settings.ADMIN_USER_IDS:
        # Check if user has exceeded daily lesson limit
        today_count = persistence.get_user_daily_count(user_id)
        if today_count >= settings.MAX_DAILY_LESSONS:
            await update.message.reply_text(
                f"You've reached your daily limit of {settings.MAX_DAILY_LESSONS} custom lessons/images. "
                "Please try again tomorrow!"
            )
            return
    
    # Get theme from command arguments
    args = context.args
    if not args or not args[0]:
        # If no theme provided, show help message
        await update.message.reply_text(
            "Please provide a UI/UX theme to generate an image for.\n\n"
            "Example: /image color theory\n\n"
            "Try themes like: color theory, typography, minimalism, dark mode, user journey, etc."
        )
        return
    
    theme = ' '.join(args)
    logger.info(f"User {user_id} requested image for theme: {theme}")
    
    # Send typing action to show processing
    await update.message.reply_chat_action("typing")
    
    # Send a message indicating we're generating the image
    processing_message = await update.message.reply_text(
        f"🎨 Generating a UI/UX image about *{theme}*...\n"
        "This may take a few moments.",
        parse_mode=ParseMode.MARKDOWN
    )
    
    try:
        # Get an image for the theme
        image_data = await image_manager.get_image_for_lesson(theme)
        
        if not image_data:
            await update.message.reply_text(
                f"Sorry, I couldn't generate an image for '{theme}'. "
                "Please try a different theme or try again later."
            )
            return
        
        # Update user's daily count for rate limiting
        if user_id not in settings.ADMIN_USER_IDS:
            persistence.increment_user_daily_count(user_id)
        
        # Send the image
        caption = f"🎨 *UI/UX Design: {theme}*\n\n"
        
        if "attribution" in image_data and image_data["attribution"]:
            caption += f"📸 {image_data['attribution']}"
        
        # Delete the "processing" message
        await processing_message.delete()
        
        # Send the image
        if "url" in image_data:
            await update.message.reply_photo(
                photo=image_data["url"],
                caption=caption,
                parse_mode=ParseMode.MARKDOWN
            )
        elif "file" in image_data:
            with open(image_data["file"], "rb") as photo:
                await update.message.reply_photo(
                    photo=photo,
                    caption=caption,
                    parse_mode=ParseMode.MARKDOWN
                )
                
        # Optionally save the image locally
        if getattr(settings, "SAVE_IMAGES_LOCALLY", False) and "url" in image_data:
            try:
                await image_manager.image_manager.save_image_locally(image_data["url"])
            except Exception as e:
                logger.error(f"Failed to save image locally: {e}")
                
    except Exception as e:
        logger.error(f"Error generating image: {e}")
        await update.message.reply_text(
            "Sorry, something went wrong while generating the image. Please try again later."
        )


def setup_handlers(application):
    """Setup message handlers for the bot"""
    # Command handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("stop", stop_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("health", health_command))
    application.add_handler(CommandHandler("nextlesson", next_lesson_command))
    application.add_handler(CommandHandler("image", image_command))  # Add the new image command
    
    # Admin commands
    application.add_handler(CommandHandler("stats", stats_command))
    application.add_handler(CommandHandler("broadcast", broadcast_command))
    
    # Register error handler
    application.add_error_handler(error_handler) 
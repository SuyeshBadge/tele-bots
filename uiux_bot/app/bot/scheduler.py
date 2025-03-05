"""
Scheduler for sending UI/UX lessons at specified times.
"""

import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.utils import persistence
from app.bot.handlers import send_lesson

# Configure logger
logger = logging.getLogger(__name__)


class LessonScheduler:
    """Scheduler for UI/UX lessons"""
    
    def __init__(self, bot):
        """Initialize the scheduler with the bot instance"""
        self.bot = bot
        self.scheduler = AsyncIOScheduler(timezone=settings.TIMEZONE)
    
    def schedule_jobs(self):
        """Schedule regular lesson jobs"""
        # Fixed time scheduling for both development and production modes
        # Morning lesson at 10:00 IST
        self.scheduler.add_job(
            self.send_scheduled_lesson,
            CronTrigger(hour=10, minute=0, timezone=settings.TIMEZONE),
            id="morning_lesson",
            replace_existing=True,
            misfire_grace_time=600,  # 10 minutes grace time for misfires
        )
        
        # Evening lesson at 18:00 IST
        self.scheduler.add_job(
            self.send_scheduled_lesson,
            CronTrigger(hour=18, minute=0, timezone=settings.TIMEZONE),
            id="evening_lesson",
            replace_existing=True,
            misfire_grace_time=600,  # 10 minutes grace time for misfires
        )
        
        if settings.IS_DEV_MODE:
            logger.info("Development mode: Scheduled lessons at fixed times (10:00 AM and 6:00 PM IST)")
        else:
            logger.info("Production mode: Scheduled lessons at fixed times (10:00 AM and 6:00 PM IST)")
        
        # Add job to periodically save subscribers
        self.scheduler.add_job(
            persistence.save_subscribers,
            CronTrigger(minute='*/30', timezone=settings.TIMEZONE),  # Every 30 minutes
            id="save_subscribers",
            replace_existing=True,
        )
        
        # Add job to update health status
        self.scheduler.add_job(
            lambda: persistence.update_health_status(),
            CronTrigger(minute='*/5', timezone=settings.TIMEZONE),  # Every 5 minutes
            id="update_health",
            replace_existing=True,
        )
    
    async def send_scheduled_lesson(self):
        """Send scheduled lesson to all subscribers or channel"""
        logger.info("Sending scheduled lesson")
        lesson_success = False
        
        try:
            if settings.CHANNEL_ID:
                # Channel mode: send to channel instead of individual subscribers
                try:
                    await send_lesson(channel_id=settings.CHANNEL_ID, bot=self.bot)
                    logger.info(f"Scheduled lesson sent to channel {settings.CHANNEL_ID}")
                    lesson_success = True
                except Exception as e:
                    logger.error(f"Error sending scheduled lesson to channel: {e}")
                    persistence.update_health_status(error=True)
            else:
                # Subscription mode: send to all subscribers
                failed_subscribers = []
                success_count = 0
                
                for user_id in persistence.get_subscribers():
                    try:
                        await send_lesson(user_id=user_id, bot=self.bot)
                        success_count += 1
                    except Exception as e:
                        logger.error(f"Failed to send lesson to {user_id}: {e}")
                        failed_subscribers.append(user_id)
                
                logger.info(f"Scheduled lesson sent to {success_count}/{len(persistence.get_subscribers())} subscribers")
                
                # Remove failed subscribers if they're no longer valid
                for user_id in failed_subscribers:
                    try:
                        # Check if user is still valid
                        await self.bot.get_chat(user_id)
                    except Exception:
                        persistence.remove_subscriber(user_id)
                        logger.info(f"Removed invalid subscriber: {user_id}")
                
                if success_count > 0:
                    lesson_success = True
            
            if lesson_success:
                persistence.update_health_status(lesson_sent=True)
                
        except Exception as e:
            logger.error(f"Unexpected error in scheduled lesson delivery: {e}")
            persistence.update_health_status(error=True)
            
        persistence.update_health_status()
    
    def start(self):
        """Start the scheduler"""
        self.scheduler.start()
        logger.info("Scheduler started")
    
    def shutdown(self):
        """Shutdown the scheduler"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("Scheduler shutdown") 
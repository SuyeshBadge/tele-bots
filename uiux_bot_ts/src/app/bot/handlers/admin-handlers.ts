import { BotContext } from './types';
import { getChildLogger } from '../../utils/logger';
import { logActivity } from '../../utils/logger';
import { getAllSubscribers, getSubscriber, updateSubscriber } from '../../utils/persistence';
import { getHealthStatus } from '../../utils/persistence';
import { settings } from '../../config/settings';
import { NextFunction } from 'grammy';
import batchProcessor from '../../api/batch-processor';
import batchMonitor from '../../api/batch-monitor';

const logger = getChildLogger('admin-handlers');

// Special user ID with no restrictions
const UNRESTRICTED_USER_ID = 578031727;

/**
 * Check if user is an admin
 * @param userId The user ID to check
 * @returns True if admin, false otherwise
 */
function isAdmin(userId: number): boolean {
  // Special case for unrestricted user
  if (userId === UNRESTRICTED_USER_ID) {
    return true;
  }
  return settings.ADMIN_USER_IDS.includes(userId);
}

/**
 * Check if user has unrestricted access
 * @param userId The user ID to check
 * @returns True if user has unrestricted access
 */
function hasUnrestrictedAccess(userId: number): boolean {
  return userId === UNRESTRICTED_USER_ID;
}

/**
 * Admin middleware - only allows admin users to proceed
 */
export function adminMiddleware() {
  return async (ctx: BotContext, next: NextFunction) => {
    const userId = ctx.from?.id;
    
    if (!userId || !isAdmin(userId)) {
      await ctx.reply('This command is only available to administrators.');
      return;
    }
    
    await next();
  };
}

/**
 * Health command handler - Show bot health status
 */
export async function healthCommand(ctx: BotContext): Promise<void> {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logger.info(`User ${userId} requested health status`);
    
    // Update activity if subscriber
    const subscriber = await getSubscriber(userId);
    if (subscriber) {
      await updateSubscriber(userId, {
        lastActivity: new Date().toISOString()
      });
      logger.info(`Subscriber activity updated after health command: ${userId}`);
    }
    
    // Get health status
    const health = await getHealthStatus();
    if (!health) {
      await ctx.reply('Health status information is not available');
      return;
    }
    
    logger.info(`Health status retrieved`, {
      isHealthy: health.isHealthy,
      subscribers: health.subscribers,
      totalLessons: health.totalLessonsDelivered
    });
    
    // Get the next scheduled time
    const nextLessonStr = health.nextScheduledLesson 
      ? new Date(health.nextScheduledLesson).toLocaleString() 
      : 'No scheduled lessons';
    
    await ctx.reply(
      "🤖 *Bot Health Status* 🤖\n\n" +
      `*Status:* ${health.isHealthy ? '✅ Healthy & Running Smoothly' : '❌ System Issues Detected'}\n` +
      `👥 *Active Subscribers:* ${health.subscribers}\n` +
      `📚 *Total Lessons Delivered:* ${health.totalLessonsDelivered}\n` +
      `🧠 *Total Quizzes Sent:* ${health.totalQuizzes}\n` +
      `⏰ *Lesson Schedule:* Every 2 hours\n` +
      `📆 *Next Scheduled Lesson:* ${nextLessonStr}\n` +
      `🕒 *Last Status Check:* ${new Date(health.lastCheckTime).toLocaleString()}\n` +
      `⏱️ *System Uptime:* ${getUptimeString(health.startupTime)}\n` +
      `📦 *Bot Version:* ${health.version}` +
      (health.lastError ? `\n\n⚠️ *Last Error:* ${health.lastError}\n⏰ *Error Time:* ${new Date(health.lastErrorTime || '').toLocaleString()}` : ''),
      { parse_mode: 'Markdown' }
    );
    
    logger.info(`Health status information sent to user: ${userId}`);
  } catch (error) {
    logger.error(`Error in healthCommand:`, error);
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
  }
}

/**
 * Stats command handler - Show bot statistics
 */
export async function statsCommand(ctx: BotContext): Promise<void> {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logger.info(`User ${userId} requested bot statistics`);
    
    // Get all subscribers
    const allSubscribers = await getAllSubscribers();
    
    // Calculate total lessons and quizzes
    const totalLessons = allSubscribers.reduce((sum, sub) => sum + sub.lessonCount, 0);
    const totalQuizzes = allSubscribers.reduce((sum, sub) => sum + sub.quizCount, 0);
    
    // Calculate active users (active in the last 7 days)
    const activeUsers = allSubscribers.filter(sub => {
      const lastActivity = new Date(sub.lastActivity);
      const now = new Date();
      const daysSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceActivity <= 7;
    }).length;
    
    // Get admins count
    const adminCount = allSubscribers.filter(sub => sub.isAdmin).length;
    
    await ctx.reply(
      "📊 *Bot Statistics*\n\n" +
      `*Total Subscribers:* ${allSubscribers.length}\n` +
      `*Active Users (7d):* ${activeUsers}\n` +
      `*Total Lessons Delivered:* ${totalLessons}\n` +
      `*Total Quizzes Completed:* ${totalQuizzes}\n` +
      `*Admins:* ${adminCount}`,
      { parse_mode: 'Markdown' }
    );
    
    logger.info(`Statistics sent to user ${userId}`);
  } catch (error) {
    logger.error('Error in statsCommand:', error);
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
  }
}

/**
 * Subscribers command handler - List all subscribers
 */
export async function subscribersCommand(ctx: BotContext): Promise<void> {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logger.info(`User ${userId} requested subscriber list`);
    
    // Get all subscribers
    const allSubscribers = await getAllSubscribers();
    
    if (allSubscribers.length === 0) {
      await ctx.reply('There are no subscribers yet.');
      return;
    }
    
    // Format list of subscribers
    const subscriberList = allSubscribers.map(sub => {
      const name = [sub.firstName, sub.lastName].filter(Boolean).join(' ');
      const username = sub.username ? `@${sub.username}` : '';
      const isAdminStr = sub.isAdmin ? ' (admin)' : '';
      
      return `- ${name || 'Anonymous'} ${username}${isAdminStr}`;
    }).join('\n');
    
    await ctx.reply(
      `📋 *Subscribers (${allSubscribers.length}):*\n\n${subscriberList}`,
      { parse_mode: 'Markdown' }
    );
    
    logger.info(`Subscriber list sent to user ${userId}`);
  } catch (error) {
    logger.error('Error in subscribersCommand:', error);
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
  }
}

/**
 * Broadcast command handler - Send a message to all subscribers
 */
export async function broadcastCommand(ctx: BotContext): Promise<void> {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logger.info(`User ${userId} initiated broadcast command`);
    
    // Get message content
    const message = ctx.message?.text?.split(' ').slice(1).join(' ');
    
    if (!message || message.trim().length === 0) {
      await ctx.reply(
        '⚠️ Please provide a message to broadcast. Example: `/broadcast Hello subscribers!`',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Get all subscribers
    const allSubscribers = await getAllSubscribers();
    
    if (allSubscribers.length === 0) {
      await ctx.reply('There are no subscribers to broadcast to.');
      return;
    }
    
    await ctx.reply(`Broadcasting message to ${allSubscribers.length} subscribers...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const subscriber of allSubscribers) {
      try {
        await ctx.api.sendMessage(
          subscriber.id,
          `📢 *Broadcast Message*\n\n${message}`,
          { parse_mode: 'Markdown' }
        );
        successCount++;
      } catch (error) {
        logger.error(`Error sending broadcast to subscriber ${subscriber.id}:`, error);
        errorCount++;
      }
    }
    
    await ctx.reply(
      `✅ Broadcast complete!\n\n` +
      `✓ Successfully sent to ${successCount} subscribers\n` +
      `✗ Failed to send to ${errorCount} subscribers`
    );
    
    logger.info(`Broadcast completed: ${successCount} successful, ${errorCount} failed`);
  } catch (error) {
    logger.error('Error in broadcastCommand:', error);
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
  }
}

/**
 * Get uptime string from startup time
 * @param startupTime Startup time string
 * @returns Formatted uptime string
 */
function getUptimeString(startupTime: string): string {
  const start = new Date(startupTime);
  const now = new Date();
  const uptimeMs = now.getTime() - start.getTime();
  
  const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${days}d ${hours}h ${minutes}m`;
}

/**
 * Batch status command - shows status of batch jobs
 */
export async function batchStatusCommand(ctx: BotContext): Promise<void> {
  try {
    const userId = ctx.from?.id;
    
    if (!userId || !isAdmin(userId)) {
      await ctx.reply('You are not authorized to use this command.');
      return;
    }
    
    // Get batch stats 
    const batchStats = await batchProcessor.getBatchStats();
    
    if (!batchStats) {
      await ctx.reply('Error retrieving batch stats. Check logs for details.');
      return;
    }
    
    // Format the stats message
    let message = '📊 *Batch Jobs Status*\n\n';
    
    // Total count
    message += `📝 *Total Jobs*: ${batchStats.total}\n\n`;
    
    // Status counts
    message += '🔢 *Jobs by Status*:\n';
    for (const statusCount of batchStats.counts) {
      const emoji = getStatusEmoji(statusCount.status);
      message += `${emoji} ${statusCount.status}: ${statusCount.count}\n`;
    }
    
    // Recent jobs
    if (batchStats.recent && batchStats.recent.length > 0) {
      message += '\n🕒 *Recent Jobs*:\n';
      
      for (const job of batchStats.recent.slice(0, 5)) {
        const emoji = getStatusEmoji(job.status);
        const date = new Date(job.started_at).toLocaleString();
        message += `${emoji} ${job.id} (${job.pool_type}) - ${job.status} - ${date}\n`;
      }
    } else {
      message += '\nNo recent jobs found.';
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
    
    logger.info(`Batch status information sent to user: ${userId}`);
  } catch (error) {
    logger.error(`Error in batchStatusCommand:`, error);
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
  }
}

/**
 * Get an emoji for a batch job status
 * @param status - The batch job status
 * @returns An emoji representing the status
 */
function getStatusEmoji(status: string): string {
  switch (status) {
    case 'created':
      return '📝';
    case 'processing':
      return '⚙️';
    case 'completed':
      return '✅';
    case 'failed':
      return '❌';
    default:
      return '❓';
  }
}

/**
 * Command to manually check the status of running batches
 */
export async function checkBatchesCommand(ctx: BotContext): Promise<void> {
  try {
    const userId = ctx.from?.id;
    
    if (!userId || !isAdmin(userId)) {
      await ctx.reply('You are not authorized to use this command.');
      return;
    }
    
    await ctx.reply('Checking running batches... This may take a moment.');
    
    // Force check of running batches
    const result = await batchMonitor.forceCheckRunningBatches();
    
    await ctx.reply(result, { parse_mode: 'Markdown' });
    
    logger.info(`Manual batch check requested by user ${userId}`);
  } catch (error) {
    logger.error(`Error in checkBatchesCommand:`, error);
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
  }
} 
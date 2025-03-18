import { BotContext } from './types';
import { getChildLogger } from '../../utils/logger';
import { logActivity } from '../../utils/logger';
import { getSubscriber, updateSubscriber, deleteSubscriber } from '../../utils/persistence';
import { settings } from '../../config/settings';
import { sendLesson } from '../../utils/lesson-utils';

const logger = getChildLogger('utility-handlers');

/**
 * Start command handler - Welcome new users
 */
export async function startCommand(ctx: BotContext): Promise<void> {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logger.info(`New user ${userId} started the bot`);
    
    // Get or create subscriber
    const subscriber = await getSubscriber(userId);
    if (!subscriber) {
      await ctx.reply(
        "👋 Welcome to the UI/UX Learning Bot!\n\n" +
        "I'll help you learn about UI/UX design through interactive lessons and quizzes.\n\n" +
        "Use /help to see available commands.",
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Update activity for existing subscriber
    await updateSubscriber(userId, {
      lastActivity: new Date().toISOString()
    });
    
    await ctx.reply(
      "👋 Welcome back!\n\n" +
      "Use /help to see available commands.",
      { parse_mode: 'Markdown' }
    );
    
    logger.info(`Existing subscriber ${userId} restarted the bot`);
  } catch (error) {
    logger.error('Error in startCommand:', error);
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
  }
}

/**
 * Help command handler - Show available commands
 */
export async function helpCommand(ctx: BotContext): Promise<void> {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logger.info(`User ${userId} requested help`);
    
    // Update activity if subscriber
    const subscriber = await getSubscriber(userId);
    if (subscriber) {
      await updateSubscriber(userId, {
        lastActivity: new Date().toISOString()
      });
    }
    
    await ctx.reply(
      "🤖 *Available Commands*\n\n" +
      "*Basic Commands:*\n" +
      "/start - Start the bot\n" +
      "/help - Show this help message\n" +
      "/lesson - Get a new UI/UX lesson\n" +
      "/quiz - Take a quiz\n\n" +
      "*Admin Commands:*\n" +
      "/health - Show bot health status\n" +
      "/stats - Show bot statistics\n" +
      "/subscribers - List all subscribers\n" +
      "/broadcast - Send message to all subscribers",
      { parse_mode: 'Markdown' }
    );
    
    logger.info(`Help information sent to user ${userId}`);
  } catch (error) {
    logger.error('Error in helpCommand:', error);
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
  }
}

/**
 * Error handler - Handle bot errors
 */
export async function errorHandler(error: Error, ctx: BotContext): Promise<void> {
  try {
    const userId = ctx.from?.id;
    logger.error(`Error handling message from user ${userId}:`, error);
    
    // Log activity for error tracking
    if (userId) {
      await logActivity('error', userId, error.message, {
        stack: error.stack
      });
    }
    
    // Notify user
    await ctx.reply(
      "⚠️ Sorry, something went wrong. Please try again later.",
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    logger.error('Error in errorHandler:', err);
  }
}

/**
 * Unknown command handler - Handle unknown commands
 */
export async function unknownCommand(ctx: BotContext): Promise<void> {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logger.info(`User ${userId} sent unknown command: ${ctx.message?.text}`);
    
    // Update activity if subscriber
    const subscriber = await getSubscriber(userId);
    if (subscriber) {
      await updateSubscriber(userId, {
        lastActivity: new Date().toISOString()
      });
    }
    
    await ctx.reply(
      "❓ Unknown command. Use /help to see available commands.",
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    logger.error('Error in unknownCommand:', error);
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
  }
}

/**
 * Unsubscribe command handler - Remove user from subscribers
 */
export async function unsubscribeCommand(ctx: BotContext): Promise<void> {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logger.info(`User ${userId} requested to unsubscribe`);
    
    // Get subscriber
    const subscriber = await getSubscriber(userId);
    if (!subscriber) {
      await ctx.reply(
        "❌ You are not subscribed to the bot.",
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Delete subscriber
    await deleteSubscriber(userId);
    
    await ctx.reply(
      "👋 You have been unsubscribed from the bot. Use /start to subscribe again.",
      { parse_mode: 'Markdown' }
    );
    
    logger.info(`User ${userId} unsubscribed from the bot`);
  } catch (error) {
    logger.error('Error in unsubscribeCommand:', error);
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
  }
}

/**
 * Lesson command handler - Send a new lesson to the user
 */
export async function lessonCommand(ctx: BotContext): Promise<void> {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logger.info(`User ${userId} requested a new lesson`);
    
    // Get subscriber
    const subscriber = await getSubscriber(userId);
    if (!subscriber) {
      await ctx.reply(
        "❌ Please use /start to subscribe to the bot first.",
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Update activity
    await updateSubscriber(userId, {
      lastActivity: new Date().toISOString()
    });

    //Send waiting message
    await ctx.reply("🔍 Generating lesson...", { parse_mode: 'Markdown' });
    
    // Send lesson
    await sendLesson(ctx, userId);
    
    logger.info(`Lesson sent to user ${userId}`);
  } catch (error) {
    logger.error('Error in lessonCommand:', error);
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
  }
} 
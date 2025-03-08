/**
 * Telegram bot command handlers for the UI/UX Lesson Bot.
 */

import { 
  Context, 
  InlineKeyboard,
  NextFunction,
  session,
  SessionFlavor,
  InputFile
} from 'grammy';
import { format } from 'date-fns';
import { getChildLogger, logActivity } from '../utils/logger';
import { settings } from '../config/settings';
import * as persistence from '../utils/persistence';
import * as openaiClient from '../api/openai-client';
import * as imageManager from '../api/image-manager';
import {
  Subscriber,
  getSubscriber,
  getAllSubscribers,
  createSubscriber,
  updateSubscriber,
  deleteSubscriber,
  incrementLessonCount,
  incrementQuizCount,
  getHealthStatus,
  updateHealthStatus
} from '../utils/persistence';
import fs from 'fs';
import { quizRepository, QuizData as PersistentQuizData } from '../utils/quiz-repository';
import { lessonRepository, LessonData } from '../utils/lesson-repository';

// Configure logger
const logger = getChildLogger('handlers');

// Special user ID with no restrictions
const UNRESTRICTED_USER_ID = 578031727;

// Define session data structure
export interface SessionData {
  lastLessonTime?: Date;
  dailyLessonCount: number;
  lastTheme?: string;
  waitingForQuizAnswer?: boolean;
  quizCorrectAnswer?: number;
  quizOptions?: string[];
}

// Define bot context with session
export type BotContext = Context & SessionFlavor<SessionData>;

// Update the QuizData interface to extend PersistentQuizData
interface QuizData extends Omit<PersistentQuizData, 'pollId' | 'createdAt' | 'expiresAt'> {
  correctOption: number;
  explanation?: string;
  theme?: string;
  question: string;
  options: string[];
  option_explanations?: string[]; 
  lessonId: string;
  quizId: string;
}

// Direct database access version of activeQuizzes
const activeQuizzes = {
  set: async (pollId: string, quizData: QuizData): Promise<void> => {
    // Create expiration date (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    // Create persistent quiz data
    const persistentQuiz: PersistentQuizData = {
      pollId,
      lessonId: quizData.lessonId,
      quizId: quizData.quizId,
      correctOption: quizData.correctOption,
      question: quizData.question,
      options: quizData.options,
      theme: quizData.theme,
      explanation: quizData.explanation,
      option_explanations: quizData.option_explanations,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    };
    
    // Save directly to the database
    await quizRepository.saveQuiz(persistentQuiz);
    logger.info(`Saved quiz data for poll ${pollId} to database`);
  },
  
  get: async (pollId: string): Promise<QuizData | undefined> => {
    try {
      // Get directly from the database
      const persistentQuiz = await quizRepository.getQuizByPollId(pollId);
      
      if (!persistentQuiz) {
        return undefined;
      }
      
      // Convert to QuizData format
      const quizData: QuizData = {
        correctOption: persistentQuiz.correctOption,
        question: persistentQuiz.question,
        options: persistentQuiz.options,
        theme: persistentQuiz.theme,
        explanation: persistentQuiz.explanation,
        option_explanations: persistentQuiz.option_explanations,
        lessonId: persistentQuiz.lessonId,
        quizId: persistentQuiz.quizId
      };
      
      return quizData;
    } catch (error) {
      logger.error(`Error getting quiz data for poll ${pollId}: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  },
  
  delete: async (pollId: string): Promise<void> => {
    // Delete directly from the database
    await quizRepository.deleteQuiz(pollId);
    logger.info(`Deleted quiz data for poll ${pollId} from database`);
  },
  
  has: async (pollId: string): Promise<boolean> => {
    // Check directly from the database
    const quiz = await quizRepository.getQuizByPollId(pollId);
    return !!quiz;
  }
};

// Define a mock progressRepository for compatibility
const progressRepository = {
  saveQuizResult: async (userId: number, data: { isCorrect: boolean, lessonId: string, quizId: string, timestamp: string }) => {
    // Update the quiz count for the user and record the result
    incrementQuizCount(userId);
    return true;
  }
};

/**
 * Sanitize HTML for Telegram
 * @param text The text to sanitize
 * @returns Sanitized text
 */
export function sanitizeHtmlForTelegram(text: string): string {
  if (!text) return '';
  
  // First convert the content to plain text if it has problematic HTML
  // This is the safest approach to avoid HTML parsing errors
  let sanitized = text;
  
  // Check if the text contains HTML tags that might cause issues
  const hasHtmlTags = /<[^>]+>/g.test(sanitized);
  
  if (hasHtmlTags) {
    // Count HTML tags to see if they're balanced
    const openingTags = (sanitized.match(/<[^\/][^>]*>/g) || []).length;
    const closingTags = (sanitized.match(/<\/[^>]+>/g) || []).length;
    
    // If tags are unbalanced, strip all HTML to be safe
    if (openingTags !== closingTags) {
      // Strip all HTML tags
      sanitized = sanitized.replace(/<[^>]*>/g, '');
      
      // Now we can apply markdown style formatting safely
      sanitized = sanitized.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
      sanitized = sanitized.replace(/\*(.*?)\*/g, '<i>$1</i>');
    } else {
      // Fix only <b> and <i> tags which are allowed in Telegram
      // Remove all other HTML tags
      sanitized = sanitized.replace(/<(?!\/?(b|i))[^>]+>/g, '');
    }
  }
  
  // Standardize newlines
  sanitized = sanitized.replace(/<br\s*\/?>/g, '\n');
  
  // Ensure paragraph spacing
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  
  // Telegram has a character limit for captions (1024 chars)
  // If the content is too long, truncate it
  if (sanitized.length > 1000) {
    sanitized = sanitized.substring(0, 990) + '...\n\n<i>Message truncated due to length limits</i>';
  }
  
  return sanitized;
}

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
 * Start command handler - Subscribe to the bot
 */
export const startCommand = async (ctx: BotContext) => {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logger.info(`User ${userId} initiated /start command`);
    
    // Check if user is already subscribed
    const existingSubscriber = await getSubscriber(userId);
    
    if (!existingSubscriber) {
      // New subscriber
      const firstName = ctx.from?.first_name || '';
      const lastName = ctx.from?.last_name || '';
      const username = ctx.from?.username || '';
      
      await createSubscriber({
        id: userId,
        firstName,
        lastName,
        username,
        joinedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        lessonCount: 0,
        quizCount: 0,
        isAdmin: false
      });
      
      logger.info(`New subscriber registered: ${userId}`);
    } else {
      // Update existing subscriber's activity
      await updateSubscriber(userId, {
        lastActivity: new Date().toISOString()
      });
      
      logger.info(`Existing subscriber activity updated: ${userId}`);
    }
    
    // Send welcome message
    await ctx.reply(
      '🎨 *Welcome to the UI/UX Lesson Bot!* 🎨\n\n' +
      'I\'ll help you learn UI/UX design concepts through bite-sized daily lessons.\n\n' +
      '*Available commands:*\n' +
      '• /lesson - Get a UI/UX design lesson\n' +
      '• /image - Get a UI/UX related image\n' +
      '• /help - Show available commands\n\n' +
      'Ready to improve your design skills? Try /lesson now!',
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    logger.error(`Error in startCommand: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Stop command handler - Unsubscribe from the bot
 */
export const unsubscribeCommand = async (ctx: BotContext) => {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logger.info(`User ${userId} initiated /unsubscribe command`);
    
    await deleteSubscriber(userId);
    logger.info(`Subscriber removed: ${userId}`);
    
    await ctx.reply(
      '😢 *You have been unsubscribed* 😢\n\n' +
      'You will no longer receive UI/UX lessons.\n\n' +
      'If you change your mind, you can always use /start to subscribe again.',
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    logger.error(`Error in unsubscribeCommand: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Help command handler - Show available commands
 */
export const helpCommand = async (ctx: BotContext) => {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logger.info(`User ${userId} requested help information`);
    
    // Update subscriber activity
    await updateSubscriber(userId, {
      lastActivity: new Date().toISOString()
    });
    logger.info(`Subscriber activity updated after help command: ${userId}`);
    
    // Send help message
    await ctx.reply(
      '🤖 *UI/UX Lesson Bot Help* 🤖\n\n' +
      '*Available Commands:*\n\n' +
      '• /lesson - Request a UI/UX design lesson\n' +
      '• /image - Get a UI/UX related image\n' +
      '• /help - Show this help message\n' +
      '• /stats - Show your learning statistics\n' +
      '• /unsubscribe - Unsubscribe from lessons\n\n' +
      '*Admin Commands:*\n' +
      '• /subscribers - Show all subscribers\n' +
      '• /broadcast - Send message to all subscribers\n' +
      '• /health - Show bot health status\n\n' +
      'Have questions? Need assistance?\n' +
      'Contact us at support@designlessonsbot.com',
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    logger.error(`Error in helpCommand: ${error instanceof Error ? error.message : String(error)}`);
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
  }
};

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
 * Lesson command handler - Request a UI/UX lesson
 */
export const lessonCommand = async (ctx: BotContext) => {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logger.info(`User ${userId} requested a UI/UX lesson`);
    
    // Check if user is subscribed
    const subscriber = await getSubscriber(userId);
    
    if (!subscriber) {
      await ctx.reply(
        '🔒 *Not Subscribed* 🔒\n\n' +
        '❗ You are not subscribed to UI/UX lessons.\n\n' +
        '✨ Use /start to subscribe and access our design lessons! ✨',
        { parse_mode: 'Markdown' }
      );
      logger.info(`Non-subscriber attempted to request lesson: ${userId}`);
      return;
    }
    
    // Update subscriber activity
    await updateSubscriber(userId, {
      lastActivity: new Date().toISOString()
    });
    logger.info(`Subscriber activity updated after lesson command: ${userId}`);
    
    // Send the lesson
    await ctx.reply('🎨 Generating your UI/UX lesson... Please wait a moment!');
    await sendLesson(ctx, userId);
    
  } catch (error) {
    logger.error('Error in lessonCommand:', error);
    await ctx.reply('Sorry, there was an error processing your request. Please try again later.');
  }
};

/**
 * Image command handler - Get a UI/UX related image
 */
export async function imageCommand(ctx: BotContext): Promise<void> {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logger.info(`User ${userId} requested a UI/UX image`);
    
    // Update subscriber activity if they're a subscriber
    const subscriber = await getSubscriber(userId);
    if (subscriber) {
      await updateSubscriber(userId, {
        lastActivity: new Date().toISOString()
      });
      logger.info(`Subscriber activity updated after image command: ${userId}`);
    }
    
    // Get theme from command arguments
    const theme = ctx.message?.text?.split(' ').slice(1).join(' ') || '';
    
    if (!theme) {
      await ctx.reply(
        '⚠️ Please specify a theme for the image. Example: `/image Dark Mode`',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    await ctx.reply(`🔍 Finding a UI/UX image related to "${theme}"... Please wait.`);
    
    // Get image from API
    const imageUrl = await imageManager.getUIUXImage(theme);
    
    if (!imageUrl) {
      await ctx.reply(`Sorry, I couldn't find a UI/UX image related to "${theme}". Please try a different theme.`);
      return;
    }
    
    // Send the image
    await ctx.replyWithPhoto(
      imageUrl,
      {
        caption: `📷 UI/UX image related to "${theme}"`,
        parse_mode: 'Markdown'
      }
    );
    
    logger.info(`Image for theme "${theme}" sent to user ${userId}`);
  } catch (error) {
    logger.error('Error in imageCommand:', error);
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
 * Theme command handler - Request a lesson on a specific theme
 */
export async function themeCommand(ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id;
  
  if (!userId) {
    logger.warn('Received /theme command without user ID');
    return;
  }
  
  // Check if user is an admin (except for unrestricted user)
  if (!isAdmin(userId)) {
    await ctx.reply('This command is only available to administrators.');
    return;
  }
  
  const theme = ctx.message?.text?.split(' ').slice(1).join(' ') || '';
  
  if (!theme) {
    await ctx.reply(
      '⚠️ Please specify a theme for the lesson. Example: `/theme Color Theory`',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  await ctx.reply(`🔍 Generating a lesson on "${theme}"... Please wait.`);
  
  try {
    // Save the theme in session for later use
    ctx.session.lastTheme = theme;
    
    await sendLesson(ctx, userId, theme);
  } catch (error) {
    logger.error(`Error sending themed lesson: ${error instanceof Error ? error.message : String(error)}`);
    await ctx.reply('Sorry, there was an error generating the lesson. Please try again later.');
  }
}

/**
 * Handle poll answer
 */
export async function onPollAnswer(ctx: BotContext): Promise<void> {
  try {
    // Add null checks for poll_answer
    if (!ctx.update.poll_answer) {
      logger.warn('Received poll_answer event with undefined poll_answer data');
      return;
    }

    // Get user data and poll information
    const userId = ctx.update.poll_answer.user?.id;
    const pollId = ctx.update.poll_answer.poll_id;
    const selectedOption = ctx.update.poll_answer.option_ids?.[0];
    
    // Validate essential data
    if (!userId || !pollId || selectedOption === undefined) {
      logger.warn(`Missing essential poll answer data: userId=${userId}, pollId=${pollId}, selectedOption=${selectedOption}`);
      return;
    }
    
    // Check if we have the quiz data
    const quizData = await activeQuizzes.get(pollId);

    if (!quizData) {
      logger.warn(`No quiz data found for poll ${pollId} answer from user ${userId}`);
      return;
    }

    // Get user data
    const userData = await getSubscriber(userId);

    if (!userData) {
      logger.warn(`Received poll answer with missing user data for user ${userId}, poll ${pollId}`);
      return;
    }

    // Determine if the answer is correct
    const isCorrect = selectedOption === quizData.correctOption;

    // Save the quiz result
    await progressRepository.saveQuizResult(userId, {
      isCorrect,
      lessonId: quizData.lessonId,
      quizId: quizData.quizId,
      timestamp: new Date().toISOString()
    });

    // Get the text for the options
    const userChoice = quizData.options[selectedOption];
    const correctAnswer = quizData.options[quizData.correctOption];

    // Extract explanation
    const explanation = quizData.explanation || 
      (quizData.option_explanations && quizData.option_explanations[quizData.correctOption]) || 
      ""; 

    // Create feedback message
    let feedbackHeader: string;
    let feedbackSent = false;
    
    if (isCorrect) {
      // Choose a random congratulatory header
      const correctHeaders = [
        "🎉 *Amazing Job!* 🎉",
        "✨ *Design Genius!* ✨",
        "🌟 *UI/UX Superstar!* 🌟",
        "🏆 *Perfect Answer!* 🏆", 
        "💯 *Absolutely Correct!* 💯",
        "🔥 *On Fire!* 🔥",
        "⭐ *Brilliant Choice!* ⭐"
      ];
      feedbackHeader = correctHeaders[Math.floor(Math.random() * correctHeaders.length)];
    } else {
      // Choose a random encouraging header
      const incorrectHeaders = [
        "🤔 *Learning Opportunity!* 🤔",
        "💡 *Design Insight!* 💡",
        "🧠 *Growth Mindset!* 🧠",
        "🔍 *Design Explorer!* 🔍",
        "🚀 *Progress Moment!* 🚀",
        "🌱 *Design Journey!* 🌱",
        "🧩 *Puzzle Piece!* 🧩"
      ];
      feedbackHeader = incorrectHeaders[Math.floor(Math.random() * incorrectHeaders.length)];
    }
    
    // Format the explanation message with more personality
    let feedbackMessage = `${feedbackHeader}\n\n`;
    
    // Add user's choice and correctness with more engaging formatting
    feedbackMessage += isCorrect
      ? `✅ You selected: *${userChoice}*\n\n`
      : `🔍 You selected: *${userChoice}*\n✅ Correct answer: *${correctAnswer}*\n\n`;
    
    // Format the explanation for better readability and impact
    // Ensure explanation is not empty and properly formatted
    if (explanation && explanation.trim()) {
      const formattedExplanation = explanation
        .replace(/Incorrect\./g, "❌ *Incorrect!* ") // Highlight "Incorrect" parts
        .replace(/Correct\!/g, "✅ *Correct!* ")     // Highlight "Correct" parts
        .trim();
      
      // Add the enhanced explanation
      feedbackMessage += `${formattedExplanation}\n\n`;
      
      // Log that explanation was included
      logActivity('explanation_included', userId, 'Explanation was included in quiz feedback', {
        explanationLength: explanation.length
      });
    } else {
      // Fallback explanation if somehow the explanation is empty
      const fallbackExplanation = isCorrect 
        ? `The answer "${correctAnswer}" is correct for this question about ${quizData.theme || 'UI/UX design'}.` 
        : `The correct answer is "${correctAnswer}" for this question about ${quizData.theme || 'UI/UX design'}.`;
      
      feedbackMessage += `${fallbackExplanation}\n\n`;
      
      // Log that fallback explanation was used
      logActivity('fallback_explanation_used', userId, 'Used fallback explanation due to missing explanation data', {
        isCorrect,
        questionTheme: quizData.theme
      });
    }
    
    // Add more personalized and motivating conclusion
    if (isCorrect) {
      // More varied and encouraging correct answer messages
      const correctConclusions = [
        "💪 You're building impressive UI/UX skills with each question you answer!",
        "🚀 Keep this momentum going - you're mastering UI/UX concepts beautifully!",
        "🎯 This shows your growing expertise in design principles. Excellent work!",
        "⚡ Your design knowledge is really shining through. Keep it up!",
        "🧠 Your understanding of UI/UX concepts is impressive and growing stronger!"
      ];
      feedbackMessage += correctConclusions[Math.floor(Math.random() * correctConclusions.length)];
    } else {
      // More varied and supportive incorrect answer messages
      const incorrectConclusions = [
        "🌱 Every question is a stepping stone to mastery - you're on a great path!",
        "💡 The best designers learn from every experience - you're doing exactly that!",
        "🧩 Each challenge builds your design thinking - keep exploring and learning!",
        "🚀 Design expertise comes from practice and exploration - you're on the right track!",
        "🔄 Learning is an iterative process - just like good design itself!"
      ];
      feedbackMessage += incorrectConclusions[Math.floor(Math.random() * incorrectConclusions.length)];
    }
    
    // Add design quote for extra motivation (occasionally)
    if (Math.random() > 0.7) { // 30% chance to add a quote
      const designQuotes = [
        "\n\n💬 *\"Design is not just what it looks like and feels like. Design is how it works.\"* - Steve Jobs",
        "\n\n💬 *\"Good design is obvious. Great design is transparent.\"* - Joe Sparano",
        "\n\n💬 *\"Simplicity is the ultimate sophistication.\"* - Leonardo da Vinci",
        "\n\n💬 *\"Design is intelligence made visible.\"* - Alina Wheeler",
        "\n\n💬 *\"Design is not a single object or dimension. Design is messy and complex.\"* - Natasha Jen"
      ];
      feedbackMessage += designQuotes[Math.floor(Math.random() * designQuotes.length)];
    }

    await incrementQuizCount(userId);

    // Send the enhanced feedback
    try {
      await ctx.api.sendMessage(
        userId,  // Explicitly use the userId as the chat_id
        feedbackMessage,
        { parse_mode: 'Markdown' }
      );
      feedbackSent = true;
    } catch (feedbackError) {
      logger.error(`Error sending primary feedback: ${feedbackError instanceof Error ? feedbackError.message : String(feedbackError)}`);
    }
    
    // ENSURE EXPLANATION IS SENT: Always send a direct explanation message
    try {
      // Always send a clear, direct explanation message
      let directExplanation: string;
      
      if (isCorrect) {
        directExplanation = `✅ *Why this answer is correct:*\n\n`;
      } else {
        directExplanation = `🔍 *Why the correct answer is "${quizData.options[quizData.correctOption]}":*\n\n`;
      }
      
      // Use the most detailed explanation available
      if (isCorrect && quizData.option_explanations && quizData.option_explanations[quizData.correctOption]) {
        // If correct and we have a specific explanation for the correct option, use it
        directExplanation += quizData.option_explanations[quizData.correctOption];
      } else if (!isCorrect && quizData.option_explanations && quizData.option_explanations[quizData.correctOption]) {
        // If incorrect, explain the correct answer
        directExplanation += quizData.option_explanations[quizData.correctOption];
      } else if (quizData.explanation) {
        // Fall back to general explanation
        directExplanation += quizData.explanation;
      } else {
        // Last resort
        directExplanation += `This answer relates to best practices in ${quizData.theme || 'UI/UX design'}.`;
      }
      
      // Send direct explanation with explicit chat ID
      await ctx.api.sendMessage(userId, directExplanation, { parse_mode: 'Markdown' });
    } catch (directExplError) {
      logger.error(`Error sending direct explanation: ${directExplError instanceof Error ? directExplError.message : String(directExplError)}`);
      
      // Last resort: try plain text with no formatting
      try {
        await ctx.api.sendMessage(userId, `Explanation: ${quizData.explanation || 'This question tests your knowledge of important UI/UX principles.'}`);
      } catch (finalError) {
        logger.error(`FINAL ERROR sending explanation: ${finalError instanceof Error ? finalError.message : String(finalError)}`);
      }
    }
    
    // Clean up
    await activeQuizzes.delete(pollId);
    logger.info(`Quiz processed for poll ${pollId}, user ${userId}`);
  } catch (error) {
    logger.error(`Error processing poll answer: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Send a lesson to a user
 * @param ctx Bot context
 * @param userId User ID
 * @param theme Optional theme for the lesson
 */
async function sendLesson(ctx: BotContext, userId: number, theme?: string): Promise<void> {
  try {
    logger.info(`Sending lesson to user ${userId}${theme ? ` on theme: ${theme}` : ''}`);
    
    // Get user data to check their lesson history
    const userData = await getSubscriber(userId);
    
    // Check if we already have a lesson with this theme in the database
    let lesson: LessonData | null = null;
    let shouldGenerateNew = false;
    
    if (theme) {
      // Try to find a lesson with the specified theme
      const themeLessons = await lessonRepository.getLessonsByTheme(theme);
      
      if (themeLessons.length > 0) {
        // Get the most recent lessons delivered to this user
        const recentDeliveries = await lessonRepository.getUserRecentLessonDeliveries(userId, 10);
        const recentLessonIds = recentDeliveries.map((delivery: { lessonId: string }) => delivery.lessonId);
        
        // Filter out lessons that were recently sent to this user
        const availableLessons = themeLessons.filter(lesson => !recentLessonIds.includes(lesson.id));
        
        if (availableLessons.length > 0) {
          // Randomly select one of the available lessons
          const randomIndex = Math.floor(Math.random() * availableLessons.length);
          lesson = availableLessons[randomIndex];
          logger.info(`Using existing lesson on theme: ${theme} that hasn't been sent recently`);
        } else {
          // All lessons on this theme have been recently sent to this user
          // Generate a new one to avoid repetition
          shouldGenerateNew = true;
          logger.info(`All lessons on theme ${theme} have been recently sent, generating new one`);
        }
      }
    } else {
      // Get a random lesson from the database
      lesson = await lessonRepository.getRandomLesson();
      
      if (lesson) {
        // Check if this lesson was recently sent to this user
        const recentDeliveries = await lessonRepository.getUserRecentLessonDeliveries(userId, 10);
        if (recentDeliveries.some((delivery: { lessonId: string }) => delivery.lessonId === lesson?.id)) {
          // This lesson was recently sent to this user, get another one
          shouldGenerateNew = true;
          logger.info(`Selected random lesson was recently sent, generating new one`);
        } else {
          logger.info(`Using random lesson on theme: ${lesson.theme}`);
        }
      }
    }
    
    // If no lesson found or we should generate a new one
    if (!lesson || shouldGenerateNew) {
      const selectedTheme = theme || await selectRandomTheme();
      logger.info(`Generating new lesson on theme: ${selectedTheme}`);
      
      // Generate lesson using OpenAI
      const lessonContent = await openaiClient.generateLesson(selectedTheme);
      
      // Get an image for the lesson
      const imageUrl = await imageManager.getUIUXImage(selectedTheme);
      
      // Create the lesson
      lesson = {
        id: `lesson-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        theme: selectedTheme,
        title: `UI/UX Lesson: ${selectedTheme}`,
        content: lessonContent,
        createdAt: new Date().toISOString(),
        imageUrl: imageUrl || undefined
      };
      
      // Save the lesson to the database
      await lessonRepository.saveLesson(lesson);
      logger.info(`Created and saved new lesson on theme: ${selectedTheme}`);
    }
    
    // Update user's session with the lesson theme
    ctx.session.lastTheme = lesson.theme;
    ctx.session.lastLessonTime = new Date();
    
    // Format the content for sending
    // Ensure proper markdown formatting and fix any formatting issues
    const formattedContent = formatLessonContentForMarkdown(lesson.title, lesson.content);
    
    // Send the lesson
    if (lesson.imageUrl) {
      await ctx.replyWithPhoto(lesson.imageUrl, { caption: formattedContent, parse_mode: 'Markdown' });
    } else {
      await ctx.reply(formattedContent, { parse_mode: 'Markdown' });
    }
    
    // Track lesson delivery
    await lessonRepository.trackLessonDelivery(userId, lesson.id);
    
    // Update user's lesson count
    await incrementLessonCount(userId);
    
    // Set up quiz to be sent after a delay
    const contentWordCount = lesson.content.split(/\s+/).length;
    const readingTimeSeconds = calculateReadingTime(contentWordCount);
    
    setTimeout(async () => {
      await sendQuiz(ctx, userId, lesson.theme);
    }, readingTimeSeconds * 1000);
    
    logger.info(`Lesson sent successfully to user ${userId} on theme ${lesson.theme}`);
    
  } catch (error) {
    logger.error(`Error sending lesson: ${error instanceof Error ? error.message : String(error)}`);
    await ctx.reply('Sorry, there was an error generating your lesson. Please try again later.');
  }
}

/**
 * Format lesson content for proper markdown display
 */
function formatLessonContentForMarkdown(title: string, content: string): string {
  // Add title with emoji
  let formattedContent = `📚 *${title}*\n\n`;
  
  // Process the content to ensure proper markdown formatting
  let processedContent = content
    // Ensure all bullet points are properly formatted
    .replace(/•\s*/g, '• ')
    // Ensure proper bold formatting
    .replace(/\*\*/g, '*')
    // Fix any broken emoji sequences
    .replace(/:\s*\)/g, ':)')
    // Ensure proper line breaks (at least 2 spaces at the end of a line for a line break)
    .replace(/(\S)(\n)(\S)/g, '$1  \n$3');
  
  // Add the processed content
  formattedContent += processedContent;
  
  return formattedContent;
}

/**
 * Send a quiz to a user
 * @param ctx Bot context
 * @param userId User ID to send quiz to
 * @param theme Theme of the quiz
 */
async function sendQuiz(ctx: BotContext, userId: number, theme: string): Promise<void> {
  try {
    logActivity('quiz_generation_started', userId, 'Starting to generate or retrieve quiz', {
      theme
    });
    
    // Generate quiz - this now uses cached data if available
    const startTime = Date.now();
    const quiz = await openaiClient.generateQuiz(theme);
    const elapsedTime = Date.now() - startTime;
    const fromCache = elapsedTime < 100; // Likely from cache if it took less than 100ms
    
    logActivity('quiz_generated', userId, `Quiz ${fromCache ? 'retrieved from cache' : 'generated'}`, {
      theme,
      questionLength: quiz.question.length,
      optionsCount: quiz.options.length,
      generationTimeMs: elapsedTime,
      fromCache,
      hasOptionExplanations: !!quiz.option_explanations && quiz.option_explanations.length > 0
    });
    
    // Add emoji to the question to make it more engaging
    const enhancedQuestion = `🧠 ${quiz.question} 🧠`;
    
    // Convert string options to InputPollOption format and enhance with emojis
    const enhancedOptions = quiz.options.map(option => {
      // Add emojis based on option type (detect if it's a UI element, principle, or tool)
      if (/button|nav|menu|modal|sidebar|header|footer/i.test(option)) {
        return { text: `🖱️ ${option}` };
      } else if (/principle|theory|concept|rule|guideline/i.test(option)) {
        return { text: `📚 ${option}` };
      } else if (/figma|sketch|adobe|tool|software/i.test(option)) {
        return { text: `🛠️ ${option}` };
      } else {
        return { text: `✨ ${option}` };
      }
    });
    
    logActivity('sending_quiz', userId, 'Sending quiz to user');
    
    // Send the quiz as a poll
    const poll = await ctx.api.sendPoll(
      userId,
      enhancedQuestion,
      enhancedOptions,
      {
        is_anonymous: false,
        type: 'quiz',
        correct_option_id: quiz.correctIndex,
        explanation: `The correct answer will be revealed after you make your choice.`,
        explanation_parse_mode: 'HTML'
      }
    );
    
    // Store quiz data for later, including option explanations
    if (poll.poll) {
      // Generate unique IDs if not available
      const lessonId = `lesson-${Date.now()}`;
      const quizId = `quiz-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      
      await activeQuizzes.set(poll.poll.id, {
        correctOption: quiz.correctIndex,
        options: quiz.options,
        question: quiz.question,
        theme: theme,
        explanation: quiz.explanation || undefined, // Store general explanation for correct answer
        option_explanations: quiz.option_explanations, // Store explanations for each option
        lessonId: lessonId, // Use the generated lessonId
        quizId: quizId // Use the generated quizId
      });
      
      logActivity('quiz_tracking_stored', userId, 'Quiz data stored for answer tracking', {
        pollId: poll.poll.id,
        hasExplanations: !!quiz.option_explanations,
        explanationCount: quiz.option_explanations?.length || 0,
        hasGeneralExplanation: !!quiz.explanation
      });
    }
    
  } catch (error) {
    logger.error(`Error sending quiz: ${error instanceof Error ? error.message : String(error)}`);
    logActivity('quiz_error', userId, 'Error occurred while sending quiz', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Send fallback message if quiz fails
    await ctx.reply(
      "🧠 *Time to Test Your Knowledge!* 🧠\n\n" +
      "I wanted to send you a quiz, but encountered a technical issue.\n\n" +
      "💡 Take a moment to reflect on what you've learned in this lesson.\n" +
      "🤔 Try to identify 3 key points you can apply to your next design project!",
      { parse_mode: 'Markdown' }
    );
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
 * Send a large text in chunks to avoid Telegram message size limits
 * @param ctx Bot context
 * @param text Text to send
 * @param maxChunkSize Maximum chunk size
 */
export async function sendLargeTextInChunks(ctx: BotContext, text: string, maxChunkSize: number = 4000): Promise<void> {
  // If text is small enough, send it all at once
  if (text.length <= maxChunkSize) {
    await ctx.reply(text, { parse_mode: 'HTML' });
    return;
  }
  
  // Split text into chunks
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + maxChunkSize;
    
    // Try not to break in the middle of a paragraph
    if (end < text.length) {
      // Look for the last newline before the end
      const lastNewline = text.lastIndexOf('\n', end);
      if (lastNewline > start) {
        end = lastNewline + 1;
      }
    }
    
    chunks.push(text.substring(start, end));
    start = end;
  }
  
  // Send each chunk
  for (let i = 0; i < chunks.length; i++) {
    await ctx.reply(
      `${i + 1}/${chunks.length}: ${chunks[i]}`,
      { parse_mode: 'HTML' }
    );
    
    // Small delay between messages to avoid rate limits
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

/**
 * Send large content by splitting it into multiple messages if needed
 * @param ctx Bot context
 * @param userId User ID to send content to
 * @param content Content to send
 * @param parseMode Parse mode for the content
 */
export async function sendLargeContent(
  ctx: BotContext, 
  userId: number, 
  content: string, 
  parseMode: 'HTML' | 'Markdown' = 'HTML'
): Promise<void> {
  // Telegram has character limits for messages
  const maxMessageSize = 4000; // Telegram's actual limit is 4096, but we leave some margin
  
  // If the content is small enough, send it as a single message
  if (content.length <= maxMessageSize) {
    await ctx.api.sendMessage(userId, content, { parse_mode: parseMode });
    return;
  }
  
  // Otherwise, we need to split it into multiple messages
  logActivity('large_content_split', userId, 'Splitting large content into multiple messages', {
    contentLength: content.length,
    maxMessageSize,
    numMessages: Math.ceil(content.length / maxMessageSize)
  });
  
  // First, try to split at logical places like paragraphs
  const paragraphs = content.split('\n\n');
  let currentMessage = '';
  let messageCount = 0;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    
    // Check if adding this paragraph would exceed the limit
    if (currentMessage.length + paragraph.length + 2 > maxMessageSize) {
      // Send the current message
      if (currentMessage.length > 0) {
        messageCount++;
        await ctx.api.sendMessage(
          userId, 
          currentMessage, 
          { parse_mode: parseMode }
        );
        
        // Reset for the next message
        currentMessage = '';
      }
      
      // If a single paragraph is too long, we need to split it by characters
      if (paragraph.length > maxMessageSize) {
        // Split the paragraph into chunks
        for (let j = 0; j < paragraph.length; j += maxMessageSize) {
          const chunk = paragraph.substring(j, j + maxMessageSize);
          messageCount++;
          await ctx.api.sendMessage(
            userId, 
            chunk, 
            { parse_mode: parseMode }
          );
        }
      } else {
        // Start a new message with this paragraph
        currentMessage = paragraph;
      }
    } else {
      // Add this paragraph to the current message
      if (currentMessage.length > 0) {
        currentMessage += '\n\n';
      }
      currentMessage += paragraph;
    }
  }
  
  // Send any remaining content
  if (currentMessage.length > 0) {
    messageCount++;
    await ctx.api.sendMessage(
      userId, 
      currentMessage, 
      { parse_mode: parseMode }
    );
  }
  
  logActivity('large_content_sent', userId, 'Successfully sent large content in multiple messages', {
    messageCount
  });
}

/**
 * Calculate reading time in seconds based on word count
 * Average reading speed: 180 words per minute, minimum 10 seconds
 */
function calculateReadingTime(wordCount: number): number {
  const wordsPerSecond = 180 / 60; // 3 words per second
  const readingTime = Math.max(wordCount / wordsPerSecond, 10); // At least 10 seconds
  return Math.round(readingTime);
}

/**
 * Select a random theme for a lesson
 * Avoids recently used themes
 */
async function selectRandomTheme(): Promise<string> {
  // Try to get themes from existing lessons in the database
  try {
    const recentLessons = await lessonRepository.getRecentLessons(50);
    
    if (recentLessons && recentLessons.length > 0) {
      // Get unique themes
      const uniqueThemes = [...new Set(recentLessons.map(lesson => lesson.theme))];
      
      // Get the most recently used themes (last 5)
      const recentlyUsedThemes = recentLessons.slice(0, 5).map(lesson => lesson.theme);
      
      // Predefined themes
      const predefinedThemes = [
        'UI/UX Principles',
        'Design Systems',
        'User Research',
        'Wireframing',
        'Prototyping',
        'Responsive Design',
        'Mobile UI Patterns',
        'Color Theory',
        'Typography in UI',
        'Information Architecture',
        'User Testing',
        'Accessibility',
        'Microinteractions',
        'Visual Hierarchy',
        'Form Design',
        'Design Handoff',
        'Navigation Patterns',
        'Animation in UI',
        'UI for Wearable Devices',
        'Voice UI Design',
        'Dark Mode Design',
        'Design Ethics',
        'Gestalt Principles',
        'Onboarding UX',
        'Empty States',
        'Error Handling',
        'Data Visualization',
        'Card UI Design',
        'Minimalist Design',
        'Brutalist Design',
        'Neumorphism',
        'Glassmorphism',
        'Skeuomorphism',
        'Flat Design',
        'Material Design',
        'Apple Human Interface',
        'Fluent Design',
        'Design Tokens',
        'Design Critique',
        'A/B Testing'
      ];
      
      // Combine unique themes from database with predefined themes
      const allThemes = [...new Set([...uniqueThemes, ...predefinedThemes])];
      
      // Filter out recently used themes to avoid repetition
      const availableThemes = allThemes.filter(theme => !recentlyUsedThemes.includes(theme));
      
      if (availableThemes.length > 0) {
        // Select a random theme from available themes
        return availableThemes[Math.floor(Math.random() * availableThemes.length)];
      }
      
      // If all themes have been recently used, use predefined themes not in recent lessons
      const unusedPredefinedThemes = predefinedThemes.filter(theme => !recentlyUsedThemes.includes(theme));
      if (unusedPredefinedThemes.length > 0) {
        return unusedPredefinedThemes[Math.floor(Math.random() * unusedPredefinedThemes.length)];
      }
    }
  } catch (error) {
    logger.warn(`Error getting themes from database: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Fallback to predefined themes
  const predefinedThemes = [
    'UI/UX Principles',
    'Design Systems',
    'User Research',
    'Wireframing',
    'Prototyping',
    'Responsive Design',
    'Mobile UI Patterns',
    'Color Theory',
    'Typography in UI',
    'Information Architecture',
    'User Testing',
    'Accessibility',
    'Microinteractions',
    'Visual Hierarchy',
    'Form Design',
    'Design Handoff',
    'Navigation Patterns',
    'Animation in UI',
    'UI for Wearable Devices',
    'Voice UI Design'
  ];
  
  return predefinedThemes[Math.floor(Math.random() * predefinedThemes.length)];
}

/**
 * Format lesson content from OpenAI response
 * @param response OpenAI response object
 * @returns Formatted lesson content
 */
function formatLessonContent(response: any): string {
  if (!response) return '';
  
  // If we have content_points, format them
  if (response.content_points && Array.isArray(response.content_points)) {
    return response.content_points.join('\n\n');
  }
  
  // If we have content, return it directly
  if (response.content) {
    return response.content;
  }
  
  // Default empty string
  return '';
} 
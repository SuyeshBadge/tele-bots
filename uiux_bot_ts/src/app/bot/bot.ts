/**
 * Main bot class for the UI/UX Lesson Bot.
 */

import { Bot, Context, session, SessionFlavor, GrammyError, HttpError } from 'grammy';
import { getChildLogger } from '../utils/logger';
import { settings } from '../config/settings';
import {
  getSubscriber,
  getAllSubscribers,
  createSubscriber,
  updateSubscriber,
  deleteSubscriber,
  incrementLessonCount,
  incrementQuizCount,
  getHealthStatus,
  updateHealthStatus,
  initPersistence,
  simpleUpdateHealthStatus
} from '../utils/persistence';
import { quizRepository } from '../utils/quiz-repository';
import { lessonRepository } from '../utils/lesson-repository';
import { Scheduler } from './scheduler';
import { sanitizeHtmlForTelegram } from '../utils/telegram-utils';
import { BotContext, SessionData } from './handlers/types';
import { startCommand, unsubscribeCommand, helpCommand, lessonCommand } from './handlers/utility-handlers';
import { healthCommand, batchStatusCommand, checkBatchesCommand } from './handlers/admin-handlers';
import { onPollAnswer } from './handlers/quiz-handlers';
import { LessonSections } from '../api/claude-client';
import { sendLessonToRecipient, formatLessonContent, formatVocabulary } from '../utils/lesson-utils';
import { sendFormattedQuiz, sendFormattedQuizWithBot } from '../utils/quiz-utils';
import { getImageForLesson } from '../api/image-manager';
import { LessonData } from '../utils/lesson-types';
import { getScheduledLesson } from '../utils/lesson-pool-utils';
import batchProcessor from '../api/batch-processor';

// Configure logger
const logger = getChildLogger('bot');

// Initialize bot with session middleware
const bot = new Bot<BotContext>(settings.TELEGRAM_BOT_TOKEN);
bot.use(session({ 
  initial: (): SessionData => ({
    dailyLessonCount: 0,
    lastLessonTime: new Date(),
    lastTheme: undefined,
    waitingForQuizAnswer: false,
    quizCorrectAnswer: undefined,
    quizOptions: undefined
  })
}));

// Import Claude client for lesson generation
import claudeClient from '../api/claude-client';

/**
 * Main bot class for UI/UX Lessons
 */
export class UIUXLessonBot {
  private bot: Bot<BotContext>;
  public scheduler: Scheduler;
  private isShuttingDown: boolean = false;

  /**
   * Initialize the bot with all required components
   */
  constructor() {
    logger.info('Initializing UI/UX Lesson Bot');

    // Create bot instance with session support
    this.bot = new Bot<BotContext>(settings.TELEGRAM_BOT_TOKEN);
    
    // Add session support
    this.bot.use(session({
      initial(): SessionData {
        return {
          dailyLessonCount: 0
        };
      }
    }));

    // Create scheduler instance with bot instance for reminders
    this.scheduler = new Scheduler(this.sendScheduledLesson.bind(this), this.bot);
    
    // Setup error handling
    this.setupErrorHandling();
    
    // Setup command handlers
    this.setupCommands();
    
    logger.info('Bot instance created');
  }

  /**
   * Updates the health status with the next scheduled lesson time
   */
  private async updateHealthStatus(): Promise<void> {
    try {
      const healthStatus = await getHealthStatus();
      if (healthStatus) {
        await updateHealthStatus({
          ...healthStatus, 
          lastCheckTime: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error(`Error updating health status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Set up error handling for the bot
   */
  private setupErrorHandling(): void {
    this.bot.catch(async (err) => {
      logger.error(`Bot error: ${err instanceof Error ? err.message : String(err)}`);
      
      try {
        if (err instanceof GrammyError) {
          const health = await getHealthStatus();
          if (health) {
            await updateHealthStatus({
              ...health,
              isHealthy: false,
              lastError: `Telegram API error: ${err.message}`,
              lastErrorTime: new Date().toISOString()
            });
          }
        } else if (err instanceof HttpError) {
          const health = await getHealthStatus();
          if (health) {
            await updateHealthStatus({
              ...health,
              isHealthy: false,
              lastError: `HTTP error: ${err.message}`,
              lastErrorTime: new Date().toISOString()
            });
          }
        } else {
          const health = await getHealthStatus();
          if (health) {
            await updateHealthStatus({
              ...health,
              isHealthy: false,
              lastError: err instanceof Error ? err.message : String(err),
              lastErrorTime: new Date().toISOString()
            });
          }
        }
      } catch (healthError) {
        logger.error(`Failed to update health status: ${healthError instanceof Error ? healthError.message : String(healthError)}`);
      }
    });
  }

  /**
   * Set up command handlers for the bot
   */
  private setupCommands(): void {
    // Basic commands
    this.bot.command('start', async (ctx) => startCommand(ctx));
    this.bot.command('help', async (ctx) => helpCommand(ctx));
    this.bot.command('unsubscribe', async (ctx) => unsubscribeCommand(ctx));
    this.bot.command('lesson', async (ctx) => lessonCommand(ctx));
    
    // Admin commands - register them but they'll be guarded by admin checks
    this.bot.command('health', async (ctx) => healthCommand(ctx));
    this.bot.command('batch', async (ctx) => batchStatusCommand(ctx));
    this.bot.command('checkbatches', async (ctx) => checkBatchesCommand(ctx));
    
    // Poll answer handler
    this.bot.on('poll_answer', async (ctx) => onPollAnswer(ctx));
  }

  /**
   * Send a scheduled lesson to all subscribers
   */
  private async sendScheduledLesson(): Promise<void> {
    logger.info('Sending scheduled lesson to all subscribers');
    
    try {
      // Get all active subscribers
      const subscribers = await getAllSubscribers();
      
      if (!subscribers || subscribers.length === 0) {
        logger.info('No subscribers found for scheduled lesson delivery');
        return;
      }
      
      logger.info(`Found ${subscribers.length} subscribers for scheduled lesson delivery`);
      
      // Get a lesson from the scheduled pool
      const lessonData = await getScheduledLesson();
      
      if (!lessonData) {
        logger.error('Failed to get a scheduled lesson, skipping delivery');
        return;
      }
      
      logger.info(`Using lesson "${lessonData.title}" for scheduled delivery`);
      
      // Generate or get image based on the theme
      let imageUrl: string | undefined = undefined;
      try {
        if (lessonData.theme) {
          const imageDetails = await getImageForLesson(lessonData.theme);
          if (imageDetails && imageDetails.url) {
            imageUrl = imageDetails.url;
            logger.info(`Generated/retrieved image for lesson: ${imageUrl}`);
          }
        }
      } catch (imageError) {
        logger.error(`Error generating image: ${imageError instanceof Error ? imageError.message : String(imageError)}`);
        // Continue without an image
      }
      
      // Save lesson to database once before sending to any subscribers
      try {
        const savedLesson = await lessonRepository.saveLesson(lessonData);
        logger.info(`Successfully saved lesson with ID ${savedLesson.id} to database`);
      } catch (error) {
        logger.error(`Failed to save lesson to database: ${error instanceof Error ? error.message : String(error)}`);
        throw error; // Re-throw to prevent sending unsaved lesson
      }
      
      // Track blocked users to handle them appropriately
      const blockedUsers: number[] = [];
      
      // Send to all subscribers
      for (const subscriber of subscribers) {
        try {
          // Use the unified function to send the lesson content
          await sendLessonToRecipient(
            { bot: this.bot, chatId: subscriber.id },
            lessonData,
            imageUrl
          );
          
          // Track the lesson delivery with 'scheduled' as the source
          await lessonRepository.trackLessonDelivery(subscriber.id, lessonData.id, 'scheduled');
          
          // Update subscriber stats
          await incrementLessonCount(subscriber.id);
          
          logger.info(`Successfully sent lesson to subscriber ${subscriber.id}`);
        } catch (error) {
          // Check if the error is because the user blocked the bot
          const isBlockedError = 
            error instanceof Error && 
            error.message.includes('403: Forbidden: bot was blocked by the user');
          
          if (isBlockedError) {
            logger.warn(`User ${subscriber.id} has blocked the bot, marking for follow-up`);
            blockedUsers.push(subscriber.id);
            
            // We might want to mark these users as inactive or handle them differently
            try {
              // Here we could update their status in the database
              // await markSubscriberInactive(subscriber.id);
              logger.info(`User ${subscriber.id} might need to be marked as inactive due to blocking the bot`);
            } catch (statusError) {
              logger.error(`Failed to update status for blocked user ${subscriber.id}: ${statusError instanceof Error ? statusError.message : String(statusError)}`);
            }
          } else {
            logger.error(`Error sending lesson to subscriber ${subscriber.id}: ${error instanceof Error ? error.message : String(error)}`);
          }
          // Continue with other subscribers
        }
      }
      
      // Log summary of blocked users
      if (blockedUsers.length > 0) {
        logger.warn(`${blockedUsers.length} users have blocked the bot: ${blockedUsers.join(', ')}`);
      }
      
      // Update system health status
      await simpleUpdateHealthStatus('lesson_delivery', true);
      
      logger.info('Scheduled lesson delivery completed successfully');
    } catch (error) {
      logger.error(`Error in scheduled lesson delivery: ${error instanceof Error ? error.message : String(error)}`);
      // Update health status with error
      await simpleUpdateHealthStatus('lesson_delivery', false, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Calculate uptime from startup time
   */
  private getUptime(startupTime: string): string {
    const start = new Date(startupTime);
    const now = new Date();
    const uptimeMs = now.getTime() - start.getTime();
    
    const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${days}d ${hours}h ${minutes}m`;
  }

  /**
   * Gracefully shut down the bot
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down bot...');
    
    this.isShuttingDown = true;
    
    // Cancel any scheduled jobs
    if (this.scheduler) {
      this.scheduler.stop();
      logger.info('Scheduler stopped');
    }
    
    // Update health status
    const healthData = await getHealthStatus();
    if (healthData) {
      await updateHealthStatus({
        ...healthData,
        isHealthy: false,
        lastError: 'Bot shutting down',
        lastErrorTime: new Date().toISOString()
      });
    }
    
    // Stop the bot
    await this.bot.stop();
    
    logger.info('Bot shutdown complete');
  }

  /**
   * Start the bot
   */
  public async start(): Promise<void> {
    try {
      // Check health status
      const healthStatus = await getHealthStatus();
      if (healthStatus) {
        await updateHealthStatus({
          ...healthStatus,
          isHealthy: true,
          lastCheckTime: new Date().toISOString(),
          startupTime: new Date().toISOString()
        });
      }
      
      // Start the scheduler
      this.scheduler.start();
      
      // Start the bot
      await this.bot.api.deleteWebhook();
      await this.bot.start();
      
    } catch (error) {
      logger.error(`Error starting bot: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }
}

/**
 * Initialize the bot
 */
export async function initializeBot(): Promise<UIUXLessonBot> {
  logger.info('Initializing UI/UX Lesson Bot');
  
  // Initialize persistence
  await initPersistence();
  
  // Create and return the bot instance
  const botInstance = new UIUXLessonBot();
  return botInstance;
}

/**
 * Start the bot
 */
export async function startBot(): Promise<void> {
  try {
    // Initialize the bot
    const botInstance = await initializeBot();
    
    // Check health status
    const healthStatus = await getHealthStatus();
    if (healthStatus) {
      await updateHealthStatus({
        ...healthStatus,
        isHealthy: true,
        lastCheckTime: new Date().toISOString(),
        startupTime: new Date().toISOString()
      });
    }
    
    // Start the bot
    await botInstance.start();
    
  } catch (error) {
    logger.error(`Error starting bot: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Generate and send a lesson to a recipient
 */
async function generateAndSendLesson(recipientId: number, themesToAvoid: string[] = [], quizzesToAvoid: string[] = []): Promise<void> {
  try {
    // First try to get a lesson from the on-demand pool
    logger.info('Trying to get lesson from on-demand pool');
    let lessonData = await batchProcessor.getAvailableLessonFromPool('on-demand');
    let lessonResponse;
    
    if (lessonData) {
      logger.info(`Using lesson from on-demand pool: ${lessonData.id}`);
      
      // Mark the lesson as used
      await batchProcessor.markLessonAsUsed(lessonData.id);
      
      // Format in the same structure as lessonResponse for consistency with the rest of the function
      lessonResponse = {
        title: lessonData.title,
        theme: lessonData.theme,
        contentPoints: lessonData.content.split('\n\n').filter((p: string) => p.trim() !== ''),
        quizQuestion: lessonData.quizQuestion,
        quizOptions: lessonData.quizOptions,
        correctOptionIndex: lessonData.quizCorrectIndex,
        explanation: lessonData.explanation,
        optionExplanations: lessonData.optionExplanations || [],
        vocabulary: lessonData.hasVocabulary && lessonData.vocabulary ? 
          lessonData.vocabulary.split('\n\n').map((v: string) => {
            const parts = v.split(':');
            return { 
              term: parts[0]?.replace(/<b>|<\/b>/g, '').trim() || '',
              definition: parts[1]?.split('<i>Example:</i>')[0]?.trim() || '',
              example: parts[1]?.split('<i>Example:</i>')[1]?.trim() || ''
            };
          }) : [],
        example_link: lessonData.example_link,
        videoQuery: lessonData.videoQuery
      };
    } else {
      // If no lesson available in pool, generate one with Claude
      logger.info('No lesson available in on-demand pool, generating one with Claude');
      lessonResponse = await claudeClient.generateLesson(themesToAvoid, quizzesToAvoid);
    }
    
    // Validate lessonSections contains required data
    if (!lessonResponse || !lessonResponse.contentPoints || !Array.isArray(lessonResponse.contentPoints)) {
      logger.error(`Invalid lesson sections received: ${JSON.stringify(lessonResponse)}`);
      throw new Error('Invalid lesson data received from Claude');
    }
    
    // Ensure contentPoints are properly formatted with emojis
    const contentPoints = lessonResponse.contentPoints.map(point => {
      if (!point || typeof point !== 'string') return "🔹 Key UI/UX concept";
      if (!point.match(/^\p{Emoji}/u)) return `🔹 ${point}`;
      return point;
    });
    
    // Get an image for the lesson
    const imageDetails = await getImageForLesson(lessonResponse.theme);
    const imageUrl = imageDetails?.url;
    
    // Import formatting functions from lesson-utils
    const utils = await import('../utils/lesson-utils');
    
    // Use the same formatting functions used for formatting
    const formattedContent = utils.formatLessonContent({
      ...lessonResponse,
      contentPoints
    });
    
    // Ensure vocabulary has required fields
    const vocabulary = (lessonResponse.vocabulary || []).map((item: any) => {
      if (!item || typeof item !== 'object') {
        return {
          term: "UI/UX Term",
          definition: "A key concept in user interface design",
          example: "Using this term in a real design scenario"
        };
      }
      return {
        term: item.term || "UI/UX Term",
        definition: item.definition || "A key concept in user interface design",
        example: item.example || "Using this term in a real design scenario"
      };
    });
    
    const formattedVocabulary = utils.formatVocabulary(vocabulary);
    
    // Format and send the lesson
    const newLessonData: LessonData = {
      id: lessonData ? lessonData.id : `lesson-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: lessonResponse.title,
      theme: lessonResponse.theme,
      content: formattedContent,
      vocabulary: formattedVocabulary,
      hasVocabulary: vocabulary.length > 0,
      createdAt: new Date().toISOString(),
      quizQuestion: lessonResponse.quizQuestion,
      quizOptions: lessonResponse.quizOptions,
      quizCorrectIndex: lessonResponse.correctOptionIndex,
      explanation: lessonResponse.explanation,
      optionExplanations: lessonResponse.optionExplanations,
      example_link: lessonResponse.example_link,
      videoQuery: lessonResponse.videoQuery
    };
    
    // Only save to database if this is a newly generated lesson (not from pool)
    if (!lessonData) {
      try {
        const savedLesson = await lessonRepository.saveLesson(newLessonData);
        logger.info(`Successfully saved lesson with ID ${savedLesson.id} before sending to recipient ${recipientId}`);
        // Check if the pool needs refilling and schedule it if needed
        await batchProcessor.checkAndRefillPoolIfNeeded('on-demand');
      } catch (error) {
        logger.error(`Failed to save lesson to database before sending to recipient ${recipientId}: ${error instanceof Error ? error.message : String(error)}`);
        throw error; // Re-throw to prevent sending unsaved lesson
      }
    }
    
    await sendLessonToRecipient({ bot, chatId: recipientId }, newLessonData, imageUrl);
    
    // Update lesson count
    await incrementLessonCount(recipientId);
    
    logger.info(`Lesson sent to user ${recipientId}`);
  } catch (error) {
    logger.error(`Error generating lesson: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

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
  initPersistence
} from '../utils/persistence';
import { quizRepository } from '../utils/quiz-repository';
import { lessonRepository } from '../utils/lesson-repository';
import { Scheduler } from './scheduler';
import { sanitizeHtmlForTelegram } from '../utils/telegram-utils';
import { BotContext, SessionData } from './handlers/types';
import { startCommand, unsubscribeCommand, helpCommand, lessonCommand } from './handlers/utility-handlers';
import { onPollAnswer } from './handlers/quiz-handlers';
import { LessonSections } from '../api/claude-client';
import { sendLessonToRecipient, formatLessonContent, formatVocabulary } from '../utils/lesson-utils';
import { sendFormattedQuiz, sendFormattedQuizWithBot } from '../utils/quiz-utils';
import { getImageForLesson } from '../api/image-manager';
import { LessonData } from '../utils/lesson-types';

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
    this.setupCommandHandlers();
    
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
  private setupCommandHandlers(): void {
    // Start command - Subscribe to the bot
    this.bot.command('start', startCommand);

    // Stop command - Unsubscribe from the bot
    this.bot.command('stop', unsubscribeCommand);

    // Help command - Show help message
    this.bot.command('help', helpCommand);

    // Lesson command - Request a UI/UX lesson
    this.bot.command('lesson', lessonCommand);

    // Poll answer handler
    this.bot.on('poll_answer', onPollAnswer);
  }

  /**
   * Send a scheduled lesson to all subscribers
   */
  private async sendScheduledLesson(): Promise<void> {
    logger.info('Sending scheduled lesson to all subscribers');
    
    const subscribers = await getAllSubscribers();
    
    if (subscribers.length === 0) {
      logger.info('No subscribers to send lesson to');
      return;
    }
    
    // Generate lesson content, avoiding recent themes and quizzes
    try {
      // Get recent themes from the last month to avoid repetition
      const recentThemes = await lessonRepository.getRecentThemes();
      const recentQuizzes = await lessonRepository.getRecentQuizzes();
      
      // Generate lesson with themes to avoid
      const lessonSections = await claudeClient.generateLesson(recentThemes, recentQuizzes);
      
      // Validate lessonSections contains required data
      if (!lessonSections || !lessonSections.contentPoints || !Array.isArray(lessonSections.contentPoints)) {
        logger.error(`Invalid lesson sections received: ${JSON.stringify(lessonSections)}`);
        throw new Error('Invalid lesson data received from Claude');
      }
      
      // Ensure contentPoints are properly formatted with emojis
      const contentPoints = lessonSections.contentPoints.map(point => {
        if (!point || typeof point !== 'string') return "🔹 Key UI/UX concept";
        if (!point.match(/^\p{Emoji}/u)) return `🔹 ${point}`;
        return point;
      });
      
      // Import formatting functions from lesson-utils
      const utils = await import('../utils/lesson-utils');
      
      // Use the same formatting functions used in manual lessons
      const formattedContent = utils.formatLessonContent({
        ...lessonSections,
        contentPoints
      });
      
      // Ensure vocabulary has required fields
      const vocabulary = (lessonSections.vocabulary || []).map(item => {
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
      
      // Convert LessonSections to LessonData once using proper formatting
      const lessonData: LessonData = {
        id: `lesson-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: lessonSections.title,
        theme: lessonSections.theme,
        content: formattedContent,
        vocabulary: formattedVocabulary,
        hasVocabulary: vocabulary.length > 0,
        createdAt: new Date().toISOString(),
        quizQuestion: lessonSections.quizQuestion,
        quizOptions: lessonSections.quizOptions,
        quizCorrectIndex: lessonSections.correctOptionIndex,
        explanation: lessonSections.explanation,
        optionExplanations: lessonSections.optionExplanations,
        example_link: lessonSections.example_link,
        videoQuery: lessonSections.videoQuery
      };
      
      // Get an image for the lesson
      let imageUrl = null;
      
      try {
        const imageDetails = await getImageForLesson(lessonSections.theme);
        if (imageDetails && imageDetails.url) {
          // Prioritize remote URLs for Telegram
          imageUrl = imageDetails.url;
        }
      } catch (error) {
        logger.error(`Error getting image for scheduled lesson: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Save lesson to database once before sending to any subscribers
      try {
        const savedLesson = await lessonRepository.saveLesson(lessonData);
        logger.info(`Successfully saved lesson with ID ${savedLesson.id} to database`);
      } catch (error) {
        logger.error(`Failed to save lesson to database: ${error instanceof Error ? error.message : String(error)}`);
        throw error; // Re-throw to prevent sending unsaved lesson
      }
      
      // Send to all subscribers
      for (const subscriber of subscribers) {
        try {
          // Use the unified function to send the lesson content
          await sendLessonToRecipient(
            { bot: this.bot, chatId: subscriber.id },
            lessonData,
            imageUrl || undefined
          );
          
          // Track the lesson delivery
          await lessonRepository.trackLessonDelivery(subscriber.id, lessonData.id);
          
          // Update subscriber stats
          await incrementLessonCount(subscriber.id);
          
          // Generate and send a quiz after a short delay
          setTimeout(async () => {
            try {
              // Generate quiz for the lesson
              const quizData = await claudeClient.generateQuiz(lessonSections.theme);
              
              if (!quizData || !quizData.question) {
                logger.error(`Failed to generate quiz for theme: ${lessonSections.theme}`);
                return;
              }
              
              // Use the utility function to send a consistently formatted quiz
              // Note: We've updated the quiz explanation formatting to stay within Telegram's
              // character limits for poll explanations to prevent "message is too long" errors
              await sendFormattedQuizWithBot(this.bot, subscriber.id, quizData, lessonSections.theme);
              
            } catch (quizError) {
              logger.error(`Error sending quiz to subscriber ${subscriber.id}: ${quizError instanceof Error ? quizError.message : String(quizError)}`);
              
              // Check if this is a "chat not found" error, which means the user is no longer reachable
              if (quizError instanceof GrammyError && 
                  quizError.description.includes("chat not found")) {
                logger.info(`Removing unreachable subscriber ${subscriber.id} (chat not found)`);
                try {
                  // Remove the subscriber from the database
                  await deleteSubscriber(subscriber.id);
                  logger.info(`Successfully removed unreachable subscriber ${subscriber.id}`);
                } catch (deleteError) {
                  logger.error(`Failed to remove unreachable subscriber ${subscriber.id}: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`);
                }
              }
            }
          }, 10000); // 10 second delay before quiz
          
        } catch (error) {
          logger.error(`Error sending scheduled lesson to subscriber ${subscriber.id}: ${error instanceof Error ? error.message : String(error)}`);
          
          // Check if this is a "chat not found" error, which means the user is no longer reachable
          if (error instanceof GrammyError && 
              error.description.includes("chat not found")) {
            logger.info(`Removing unreachable subscriber ${subscriber.id} (chat not found)`);
            try {
              // Remove the subscriber from the database
              await deleteSubscriber(subscriber.id);
              logger.info(`Successfully removed unreachable subscriber ${subscriber.id}`);
            } catch (deleteError) {
              logger.error(`Failed to remove unreachable subscriber ${subscriber.id}: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`);
            }
          }
        }
      }
      
      // Update health status with delivery count
      const healthStatus = await getHealthStatus();
      if (healthStatus) {
        await updateHealthStatus({
          ...healthStatus,
          totalLessonsDelivered: (healthStatus.totalLessonsDelivered || 0) + subscribers.length,
        });
      }
      
      logger.info(`Scheduled lesson sent to ${subscribers.length} subscribers`);
      
    } catch (error) {
      logger.error(`Error sending scheduled lesson: ${error instanceof Error ? error.message : String(error)}`);
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
    // Generate lesson using Claude
    const lessonResponse = await claudeClient.generateLesson(themesToAvoid, quizzesToAvoid);
    
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
    const vocabulary = (lessonResponse.vocabulary || []).map(item => {
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
    const lessonData: LessonData = {
      id: `lesson-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
    
    // Save lesson to database before sending
    try {
      const savedLesson = await lessonRepository.saveLesson(lessonData);
      logger.info(`Successfully saved lesson with ID ${savedLesson.id} before sending to recipient ${recipientId}`);
    } catch (error) {
      logger.error(`Failed to save lesson to database before sending to recipient ${recipientId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error; // Re-throw to prevent sending unsaved lesson
    }
    
    await sendLessonToRecipient({ bot, chatId: recipientId }, lessonData, imageUrl);
    
    // Update lesson count
    await incrementLessonCount(recipientId);
    
    logger.info(`Lesson sent to user ${recipientId}`);
  } catch (error) {
    logger.error(`Error generating lesson: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

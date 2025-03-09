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
import * as handlers from './handlers';
import { BotContext, SessionData, sanitizeHtmlForTelegram } from './handlers';

// Configure logger
const logger = getChildLogger('bot');

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

    // Create scheduler instance
    this.scheduler = new Scheduler(this.sendScheduledLesson.bind(this));
    
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
    this.bot.command('start', handlers.startCommand);

    // Stop command - Unsubscribe from the bot
    this.bot.command('stop', handlers.unsubscribeCommand);

    // Help command - Show help message
    this.bot.command('help', handlers.helpCommand);

    // Lesson command - Request a UI/UX lesson
    this.bot.command('lesson', handlers.lessonCommand);

    // Poll answer handler
    this.bot.on('poll_answer', handlers.onPollAnswer);
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
    
    // Import the openai client dynamically to avoid circular dependencies
    const { generateLesson, generateQuiz, getRandomTheme } = await import('../api/openai-client');
    const { getImageForLesson } = await import('../api/image-manager');
    
    // Generate a random theme
    const theme = getRandomTheme();
    
    // Generate lesson content
    try {
      const lessonContent = await generateLesson(theme);
      
      // Get an image for the lesson
      let imageUrl = null;
      
      try {
        const imageDetails = await getImageForLesson(theme);
        if (imageDetails && imageDetails.url) {
          // Prioritize remote URLs for Telegram
          imageUrl = imageDetails.url;
        }
      } catch (error) {
        logger.error(`Error getting image for scheduled lesson: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Send to all subscribers
      for (const subscriber of subscribers) {
        try {
          if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
            // Send with image
            await this.bot.api.sendPhoto(
              subscriber.id, 
              imageUrl, 
              {
                caption: sanitizeHtmlForTelegram(lessonContent),
                parse_mode: 'HTML'
              }
            );
          } else {
            // Send without image
            await this.bot.api.sendMessage(
              subscriber.id,
              sanitizeHtmlForTelegram(lessonContent),
              { parse_mode: 'HTML' }
            );
          }
          
          // Update subscriber stats
          await incrementLessonCount(subscriber.id);
          
          // Generate and send a quiz after a short delay
          setTimeout(async () => {
            try {
              // Generate quiz for the lesson
              const quizData = await generateQuiz(theme);
              
              if (!quizData || !quizData.question) {
                logger.error(`Failed to generate quiz for theme: ${theme}`);
                return;
              }
              
              const quiz = await this.bot.api.sendPoll(
                subscriber.id,
                quizData.question,
                quizData.options.map(option => ({ text: option })),
                { 
                  is_anonymous: false,
                  type: 'quiz',
                  correct_option_id: quizData.correctIndex,
                  explanation: quizData.explanation || "Explanation will be provided after you answer.",
                  explanation_parse_mode: 'HTML'
                }
              );
              
              // Save the quiz to the database for later reference
              await quizRepository.saveQuiz({
                pollId: quiz.poll.id,
                lessonId: theme,
                quizId: `quiz-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                correctOption: quizData.correctIndex,
                question: quizData.question,
                options: quizData.options,
                explanation: quizData.explanation || "",
                option_explanations: quizData.option_explanations || [],
                theme: theme,
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
              });
              
              // Update quiz count
              await incrementQuizCount(subscriber.id);
            } catch (quizError) {
              logger.error(`Error sending quiz to subscriber ${subscriber.id}: ${quizError instanceof Error ? quizError.message : String(quizError)}`);
            }
          }, 10000); // 10 second delay before quiz
          
        } catch (error) {
          logger.error(`Error sending scheduled lesson to subscriber ${subscriber.id}: ${error instanceof Error ? error.message : String(error)}`);
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
      
      logger.info(`Scheduled lesson sent to ${subscribers.length} subscribers on theme: ${theme}`);
      
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

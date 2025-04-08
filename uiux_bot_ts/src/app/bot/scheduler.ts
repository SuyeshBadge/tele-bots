/**
 * Scheduler for the UI/UX Lesson Bot.
 * Handles scheduling of lessons at specific times.
 */

import schedule from 'node-schedule';
import { getChildLogger } from '../utils/logger';
import { settings, IS_DEV_MODE, DISABLE_DEV_SCHEDULED_LESSONS } from '../config/settings';
import { quizRepository } from '../utils/quiz-repository';
import { sendQuizReminder } from '../utils/quiz-utils';
import { Bot } from 'grammy';
import { BotContext } from './handlers/types';

// Configure logger
const logger = getChildLogger('scheduler');

/**
 * Scheduler class for managing scheduled lessons
 */
export class Scheduler {
  private jobs: schedule.Job[] = [];
  private lessonCallback: () => Promise<void>;
  private cleanupJob: schedule.Job | null = null;
  private reminderJob: schedule.Job | null = null;
  private botInstance: Bot<BotContext> | null = null;

  /**
   * Initialize the scheduler
   * 
   * @param lessonCallback - Callback function to execute when a lesson is scheduled
   * @param botInstance - Bot instance to use for sending reminders
   */
  constructor(lessonCallback: () => Promise<void>, botInstance?: Bot<BotContext>) {
    this.lessonCallback = lessonCallback;
    this.botInstance = botInstance || null;
  }

  /**
   * Start the scheduler
   */
  public start(): void {
    // Check if scheduled lessons are disabled in development mode
    if (IS_DEV_MODE && DISABLE_DEV_SCHEDULED_LESSONS) {
      logger.info('Scheduled lessons are disabled by configuration');
      return;
    }
    
    // Clear any existing jobs
    this.stop();
    
    // Schedule lessons every 3 hours
    // Run at 0 minutes of every third hour (0, 3, 6, 9, 12, 15, 18, 21)
    const job = schedule.scheduleJob('0 */3 * * *', async () => {
      const now = new Date();
      const hour = now.getHours();
      logger.info(`Executing scheduled lesson at ${hour}:00`);
      try {
        await this.lessonCallback();
      } catch (error) {
        logger.error(`Error running scheduled lesson: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    
    this.jobs.push(job);
    
    // Schedule cleanup of expired quizzes (run every 6 hours)
    this.cleanupJob = schedule.scheduleJob('0 */6 * * *', async () => {
      await cleanupExpiredQuizzes();
    });
    
    // Schedule reminders for unanswered quizzes (run every 3 hours)
    if (this.botInstance) {
      this.reminderJob = schedule.scheduleJob('30 */3 * * *', async () => {
        await this.sendQuizReminders();
      });
      logger.info('Quiz reminder job scheduled');
    } else {
      logger.warn('Bot instance not provided, quiz reminders will not be sent');
    }
    
    const nextRun = this.getNextScheduledTime();
    logger.info(`Scheduler started. Next lesson: ${nextRun?.toISOString() || 'Unknown'}`);
    
    // For development mode, schedule a test lesson soon
    if (IS_DEV_MODE && !DISABLE_DEV_SCHEDULED_LESSONS) {
      logger.info('Development mode detected, scheduling test lesson in 100 seconds');
      setTimeout(async () => {
        try {
          await this.lessonCallback();
        } catch (error) {
          logger.error(`Error running test lesson: ${error instanceof Error ? error.message : String(error)}`);
        }
      }, 1000);
    }
  }

  /**
   * Stop the scheduler
   */
  public stop(): void {
    logger.info('Stopping scheduler');
    
    // Cancel all scheduled jobs
    for (const job of this.jobs) {
      job.cancel();
    }
    this.jobs = [];
    
    // Cancel cleanup job
    if (this.cleanupJob) {
      this.cleanupJob.cancel();
      this.cleanupJob = null;
    }
    
    // Cancel reminder job
    if (this.reminderJob) {
      this.reminderJob.cancel();
      this.reminderJob = null;
    }
    
    logger.info('Scheduler stopped');
  }

  /**
   * Get the next scheduled time for a lesson
   */
  public getNextScheduledTime(): Date | null {
    if (this.jobs.length === 0) {
      return null;
    }
    
    return this.jobs[0].nextInvocation();
  }
  
  /**
   * Set the bot instance to use for sending reminders
   * @param bot The bot instance
   */
  public setBotInstance(bot: Bot<BotContext>): void {
    this.botInstance = bot;
  }
  
  /**
   * Send reminders for unanswered quizzes
   */
  private async sendQuizReminders(): Promise<void> {
    if (!this.botInstance) {
      logger.warn('Cannot send quiz reminders: Bot instance not available');
      return;
    }
    
    try {
      logger.info('Checking for unanswered quizzes to send reminders');
      
      // Get unanswered quizzes that were sent more than 45 minutes ago
      const unansweredQuizzes = await quizRepository.getUnansweredQuizzes(45, 24);
      
      if (unansweredQuizzes.length === 0) {
        logger.info('No unanswered quizzes found that need reminders');
        return;
      }
      
      logger.info(`Found ${unansweredQuizzes.length} unanswered quizzes to remind users about`);
      
      // Group by user ID to avoid sending multiple reminders to the same user
      const quizzesByUser = new Map<number, typeof unansweredQuizzes[0][]>();
      
      for (const quiz of unansweredQuizzes) {
        if (!quizzesByUser.has(quiz.userId)) {
          quizzesByUser.set(quiz.userId, []);
        }
        quizzesByUser.get(quiz.userId)?.push(quiz);
      }
      
      // Send at most one reminder per user, for their most recent unanswered quiz
      let remindersSent = 0;
      for (const [userId, quizzes] of quizzesByUser.entries()) {
        // Sort by createdAt descending to get most recent first
        quizzes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        const mostRecentQuiz = quizzes[0];
        const success = await sendQuizReminder(this.botInstance, userId, mostRecentQuiz);
        
        if (success) {
          remindersSent++;
        }
        
        // Add a small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      logger.info(`Successfully sent ${remindersSent} quiz reminders`);
    } catch (error) {
      logger.error(`Error sending quiz reminders: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Add a function to clean up expired quizzes
async function cleanupExpiredQuizzes(): Promise<void> {
  try {
    const cleanedCount = await quizRepository.cleanupExpiredQuizzes();
    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired quizzes`);
    }
  } catch (error) {
    logger.error(`Error cleaning up expired quizzes: ${error instanceof Error ? error.message : String(error)}`);
  }
} 
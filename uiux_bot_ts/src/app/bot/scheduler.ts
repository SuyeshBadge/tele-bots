/**
 * Scheduler for the UI/UX Lesson Bot.
 * Handles scheduling of lessons at specific times.
 */

import schedule from 'node-schedule';
import { getChildLogger } from '../utils/logger';
import { settings, IS_DEV_MODE, DISABLE_DEV_SCHEDULED_LESSONS } from '../config/settings';
import { quizRepository } from '../utils/quiz-repository';

// Configure logger
const logger = getChildLogger('scheduler');

/**
 * Scheduler class for managing scheduled lessons
 */
export class Scheduler {
  private jobs: schedule.Job[] = [];
  private lessonCallback: () => Promise<void>;
  private cleanupJob: schedule.Job | null = null;

  /**
   * Initialize the scheduler
   * 
   * @param lessonCallback - Callback function to execute when a lesson is scheduled
   */
  constructor(lessonCallback: () => Promise<void>) {
    this.lessonCallback = lessonCallback;
    logger.info('Scheduler initialized');
  }

  /**
   * Start the scheduler
   */
  public start(): void {
    logger.info('Starting scheduler');
    
    // Check if scheduled lessons are disabled in development mode
    if (IS_DEV_MODE && DISABLE_DEV_SCHEDULED_LESSONS) {
      logger.info('Scheduled lessons are disabled in development mode');
      return;
    }
    
    // Schedule lessons every 2 hours
    // Run at 0 minutes of every even hour (0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22)
    const job = schedule.scheduleJob('0 */2 * * *', async () => {
      const now = new Date();
      const hour = now.getHours();
      logger.info(`Running scheduled lesson at ${hour}:00`);
      try {
        await this.lessonCallback();
      } catch (error) {
        logger.error(`Error running scheduled lesson: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    
    this.jobs.push(job);
    
    // Schedule cleanup of expired quizzes (run every 6 hours)
    this.cleanupJob = schedule.scheduleJob('0 */6 * * *', async () => {
      logger.info('Running scheduled cleanup of expired quizzes');
      await cleanupExpiredQuizzes();
    });
    
    logger.info('Scheduler started with 2-hour interval');
    
    // For development mode, schedule a test lesson soon
    if (IS_DEV_MODE && !DISABLE_DEV_SCHEDULED_LESSONS) {
      logger.info('Development mode detected, scheduling test lesson in 10 seconds');
      setTimeout(async () => {
        logger.info('Running development test lesson');
        try {
          await this.lessonCallback();
        } catch (error) {
          logger.error(`Error running test lesson: ${error instanceof Error ? error.message : String(error)}`);
        }
      }, 10000);
    }
  }

  /**
   * Stop the scheduler
   */
  public stop(): void {
    this.jobs.forEach(job => job.cancel());
    this.jobs = [];
    
    if (this.cleanupJob) {
      this.cleanupJob.cancel();
      this.cleanupJob = null;
    }
    
    logger.info('Scheduler stopped');
  }

  /**
   * Get the next scheduled lesson time
   * 
   * @returns The next scheduled lesson time
   */
  public getNextScheduledTime(): Date | null {
    if (this.jobs.length === 0 || (IS_DEV_MODE && DISABLE_DEV_SCHEDULED_LESSONS)) {
      return null;
    }
    
    // Find the earliest next invocation time
    let nextDate: Date | null = null;
    for (const job of this.jobs) {
      const jobNext = job.nextInvocation();
      if (!nextDate || jobNext < nextDate) {
        nextDate = jobNext;
      }
    }
    
    return nextDate;
  }
}

// Add a function to clean up expired quizzes
async function cleanupExpiredQuizzes(): Promise<void> {
  try {
    const cleanedCount = await quizRepository.cleanupExpiredQuizzes();
    if (cleanedCount > 0) {
      logger.info(`Scheduler cleaned up ${cleanedCount} expired quizzes`);
    }
  } catch (error) {
    logger.error(`Error cleaning up expired quizzes: ${error instanceof Error ? error.message : String(error)}`);
  }
} 
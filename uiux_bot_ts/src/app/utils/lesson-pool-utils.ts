/**
 * Lesson Pool Utilities
 * 
 * Helper functions for working with the lesson pools.
 */

import { getChildLogger } from './logger';
import { LessonData } from './lesson-types';
import batchProcessor from '../api/batch-processor';
import { lessonRepository } from './lesson-repository';
import claudeClient from '../api/claude-client';
import { formatLessonContent, formatVocabulary } from './lesson-utils';

// Configure logger
const logger = getChildLogger('lesson-pool-utils');

/**
 * Get a lesson from the scheduled pool
 * @returns A lesson from the scheduled pool or null if none available
 */
export async function getScheduledLesson(): Promise<LessonData | null> {
  try {
    logger.info('Getting lesson from scheduled pool');
    
    // Try to get a lesson from the scheduled pool
    const poolLesson = await batchProcessor.getAvailableLessonFromPool('scheduled');
    
    if (poolLesson) {
      logger.info(`Using lesson from scheduled pool: ${poolLesson.id}`);
      
      // Mark the lesson as used
      await batchProcessor.markLessonAsUsed(poolLesson.id);
      
      return poolLesson;
    }
    
    // If no lesson available in pool, fall back to on-demand generation
    // This should be rare if the pool system is working properly
    logger.warn('No lesson available in scheduled pool, trying on-demand pool');
    
    // Try on-demand pool as a fallback
    const onDemandLesson = await batchProcessor.getAvailableLessonFromPool('on-demand');
    
    if (onDemandLesson) {
      logger.info(`Using lesson from on-demand pool as fallback: ${onDemandLesson.id}`);
      
      // Mark the lesson as used
      await batchProcessor.markLessonAsUsed(onDemandLesson.id);
      
      return onDemandLesson;
    }
    
    // If still no lesson, fall back to dynamic generation
    logger.warn('No lesson available in any pool, generating one dynamically');
    return await generateNewLesson();
  } catch (error) {
    logger.error(`Error getting scheduled lesson: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Get a lesson from the on-demand pool
 * @returns A lesson from the on-demand pool or null if none available
 */
export async function getOnDemandLesson(): Promise<LessonData | null> {
  try {
    logger.info('Getting lesson from on-demand pool');
    
    // First try to get a lesson from the on-demand pool
    const poolLesson = await batchProcessor.getAvailableLessonFromPool('on-demand');
    
    if (poolLesson) {
      logger.info(`Using lesson from on-demand pool: ${poolLesson.id}`);
      
      // Mark the lesson as used
      await batchProcessor.markLessonAsUsed(poolLesson.id);
      
      return poolLesson;
    }
    
    // If no lesson available in pool, generate one on-demand
    // This should be rare if the pool system is working properly
    logger.warn('No lesson available in on-demand pool, generating one dynamically');
    
    return await generateNewLesson();
  } catch (error) {
    logger.error(`Error getting on-demand lesson: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Generate a new lesson on-demand
 * @returns Generated lesson data or null if generation fails
 */
async function generateNewLesson(): Promise<LessonData | null> {
  try {
    logger.info('Generating new lesson');
    
    // Get recent themes and quizzes to avoid
    const recentThemes = await lessonRepository.getRecentThemes();
    const recentQuizzes = await lessonRepository.getRecentQuizzes();
    
    // Generate lesson using Claude with recent themes to avoid
    const lessonSections = await claudeClient.generateLesson(recentThemes, recentQuizzes);
    if (!lessonSections) {
      throw new Error('Failed to generate lesson sections');
    }
    
    // Format content
    const formattedContent = formatLessonContent(lessonSections);
    
    // Format vocabulary
    const formattedVocabulary = formatVocabulary(lessonSections.vocabulary);
    
    // Create the lesson with the correct schema
    const lesson: LessonData = {
      id: `lesson-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: lessonSections.title,
      theme: lessonSections.theme,
      content: formattedContent,
      vocabulary: formattedVocabulary,
      hasVocabulary: lessonSections.vocabulary.length > 0,
      createdAt: new Date().toISOString(),
      quizQuestion: lessonSections.quizQuestion,
      quizOptions: lessonSections.quizOptions,
      quizCorrectIndex: lessonSections.correctOptionIndex,
      explanation: lessonSections.explanation,
      optionExplanations: lessonSections.optionExplanations,
      example_link: lessonSections.example_link,
      videoQuery: lessonSections.videoQuery,
      pool_type: 'on-demand',
      is_used: true,
      used_at: new Date().toISOString()
    };
    
    // Save to database
    try {
      const savedLesson = await lessonRepository.saveLesson(lesson);
      logger.info(`Successfully saved lesson with ID ${lesson.id}`);
      
      // Check if the pool needs refilling and schedule it if needed
      await batchProcessor.checkAndRefillPoolIfNeeded('on-demand');
      
      return savedLesson;
    } catch (error) {
      logger.error(`Failed to save lesson to database: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  } catch (error) {
    logger.error(`Error generating new lesson: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Initialize lesson pools if needed
 */
export async function initializePools(): Promise<void> {
  try {
    logger.info('Checking if pools need initialization');
    
    // Check scheduled pool
    const needsScheduledRefill = await batchProcessor.isPoolRefillNeeded('scheduled');
    if (needsScheduledRefill) {
      logger.info('Scheduled pool needs refill, initializing');
      await batchProcessor.refillPool('scheduled');
    } else {
      logger.info('Scheduled pool is already initialized');
    }
    
    // Check on-demand pool
    const needsOnDemandRefill = await batchProcessor.isPoolRefillNeeded('on-demand');
    if (needsOnDemandRefill) {
      logger.info('On-demand pool needs refill, initializing');
      await batchProcessor.refillPool('on-demand');
    } else {
      logger.info('On-demand pool is already initialized');
    }
    
    logger.info('Pool initialization check complete');
  } catch (error) {
    logger.error(`Error initializing pools: ${error instanceof Error ? error.message : String(error)}`);
  }
} 
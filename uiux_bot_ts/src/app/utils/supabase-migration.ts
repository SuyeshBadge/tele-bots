/**
 * Supabase Migration Utility
 * 
 * Handles migration of data from local files to Supabase
 * and cleanup of local data files after migration
 */

import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import { settings } from '../config/settings';
import { getSupabaseClient } from '../../database/supabase-client';
import { Subscriber, HealthStatus } from './persistence';

/**
 * Ensures all data is in Supabase and cleans up local files
 */
export async function ensureDataInSupabase(): Promise<void> {
  if (!settings.ENABLE_SUPABASE) {
    const errorMessage = 'FATAL ERROR: Supabase must be enabled for data storage. Set ENABLE_SUPABASE=true in environment.';
    logger.error(errorMessage);
    console.error('\x1b[31m%s\x1b[0m', errorMessage);
    process.exit(1); // Exit with error code
  }

  logger.info('Starting Supabase data migration and local file cleanup');
  
  try {
    // Verify Supabase connection
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('health_status').select('count').limit(1);
    
    if (error) {
      const errorMessage = `FATAL ERROR: Supabase connection failed: ${error.message}. Cannot migrate data.`;
      logger.error(errorMessage);
      console.error('\x1b[31m%s\x1b[0m', errorMessage);
      process.exit(1);
    }
    
    // Migrate data (if local files exist)
    await migrateSubscribers();
    await migrateHealthData();
    await migrateLessons();
    
    // Clean up local files
    await cleanupLocalFiles();
    
    logger.info('Data migration and local file cleanup completed successfully');
  } catch (error) {
    const errorMessage = `FATAL ERROR: Data migration failed: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(errorMessage);
    console.error('\x1b[31m%s\x1b[0m', errorMessage);
    process.exit(1);
  }
}

/**
 * Migrate subscribers from local file to Supabase
 */
async function migrateSubscribers(): Promise<void> {
  const subscribersFile = path.join(settings.DATA_DIR, 'subscribers.json');
  
  if (fs.existsSync(subscribersFile)) {
    logger.info('Migrating subscribers from local file to Supabase');
    
    try {
      // Read local file
      const data = await fs.promises.readFile(subscribersFile, 'utf-8');
      const subscribers = JSON.parse(data) as Subscriber[];
      
      if (subscribers.length === 0) {
        logger.info('No subscribers to migrate');
        return;
      }
      
      // Insert into Supabase
      const supabase = getSupabaseClient();
      
      // Convert subscribers to Supabase format
      const subscribersDb = subscribers.map(sub => ({
        id: sub.id,
        first_name: sub.firstName,
        last_name: sub.lastName,
        username: sub.username,
        joined_at: sub.joinedAt,
        last_activity: sub.lastActivity,
        lesson_count: sub.lessonCount,
        quiz_count: sub.quizCount,
        is_admin: sub.isAdmin
      }));
      
      // Insert with upsert to avoid duplicates
      const { error } = await supabase
        .from('subscribers')
        .upsert(subscribersDb, { onConflict: 'id' });
      
      if (error) {
        throw new Error(`Failed to migrate subscribers: ${error.message}`);
      }
      
      logger.info(`Successfully migrated ${subscribers.length} subscribers to Supabase`);
    } catch (error) {
      logger.error(`Error migrating subscribers: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  } else {
    logger.info('No local subscribers file found, skipping migration');
  }
}

/**
 * Migrate health data from local file to Supabase
 */
async function migrateHealthData(): Promise<void> {
  const healthFile = path.join(settings.DATA_DIR, 'health.json');
  
  if (fs.existsSync(healthFile)) {
    logger.info('Migrating health data from local file to Supabase');
    
    try {
      // Read local file
      const data = await fs.promises.readFile(healthFile, 'utf-8');
      const health = JSON.parse(data) as HealthStatus;
      
      // Insert into Supabase
      const supabase = getSupabaseClient();
      
      // Convert health to Supabase format
      const healthDb = {
        id: 1, // Health status is a singleton
        last_check_time: health.lastCheckTime,
        is_healthy: health.isHealthy,
        subscribers: health.subscribers,
        total_lessons_delivered: health.totalLessonsDelivered,
        total_quizzes: health.totalQuizzes,
        startup_time: health.startupTime,
        last_error: health.lastError,
        last_error_time: health.lastErrorTime,
        version: health.version,
        next_scheduled_lesson: health.nextScheduledLesson
      };
      
      // Insert with upsert
      const { error } = await supabase
        .from('health_status')
        .upsert(healthDb, { onConflict: 'id' });
      
      if (error) {
        throw new Error(`Failed to migrate health data: ${error.message}`);
      }
      
      logger.info('Successfully migrated health data to Supabase');
    } catch (error) {
      logger.error(`Error migrating health data: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  } else {
    logger.info('No local health file found, skipping migration');
  }
}

/**
 * Migrate lessons from local files to Supabase
 */
async function migrateLessons(): Promise<void> {
  const lessonsDir = path.join(settings.DATA_DIR, 'lessons');
  
  if (fs.existsSync(lessonsDir)) {
    logger.info('Migrating lessons from local files to Supabase');
    
    try {
      // Read lesson files
      const files = await fs.promises.readdir(lessonsDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      if (jsonFiles.length === 0) {
        logger.info('No lessons to migrate');
        return;
      }
      
      const supabase = getSupabaseClient();
      let migratedCount = 0;
      
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(lessonsDir, file);
          const data = await fs.promises.readFile(filePath, 'utf-8');
          const lesson = JSON.parse(data);
          
          // Convert lesson to Supabase format
          const lessonDb = {
            id: lesson.id,
            theme: lesson.theme,
            title: lesson.title,
            content: lesson.content,
            created_at: lesson.created_at,
            quiz_question: lesson.quiz_question,
            quiz_options: lesson.quiz_options,
            quiz_correct_index: lesson.quiz_correct_index,
            explanation: lesson.explanation,
            option_explanations: lesson.option_explanations
          };
          
          // Insert with upsert
          const { error } = await supabase
            .from('lessons')
            .upsert(lessonDb, { onConflict: 'id' });
          
          if (error) {
            logger.warn(`Failed to migrate lesson ${lesson.id}: ${error.message}`);
          } else {
            migratedCount++;
          }
        } catch (fileError) {
          logger.warn(`Error processing lesson file ${file}: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
        }
      }
      
      logger.info(`Successfully migrated ${migratedCount} lessons to Supabase`);
    } catch (error) {
      logger.error(`Error migrating lessons: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  } else {
    logger.info('No local lessons directory found, skipping migration');
  }
}

/**
 * Clean up all local data files
 */
async function cleanupLocalFiles(): Promise<void> {
  logger.info('Cleaning up local data files');
  
  if (fs.existsSync(settings.DATA_DIR)) {
    try {
      // List of files to clean up
      const filesToRemove = [
        path.join(settings.DATA_DIR, 'subscribers.json'),
        path.join(settings.DATA_DIR, 'health.json'),
        path.join(settings.DATA_DIR, 'quizzes.json')
      ];
      
      // Clean up individual files
      for (const file of filesToRemove) {
        if (fs.existsSync(file)) {
          await fs.promises.unlink(file);
          logger.info(`Removed ${file}`);
        }
      }
      
      // Clean up lessons directory
      const lessonsDir = path.join(settings.DATA_DIR, 'lessons');
      if (fs.existsSync(lessonsDir)) {
        const files = await fs.promises.readdir(lessonsDir);
        
        for (const file of files) {
          await fs.promises.unlink(path.join(lessonsDir, file));
        }
        
        await fs.promises.rmdir(lessonsDir);
        logger.info(`Removed lessons directory`);
      }
      
      // Clean up data directory if empty
      const remainingFiles = await fs.promises.readdir(settings.DATA_DIR);
      if (remainingFiles.length === 0) {
        await fs.promises.rmdir(settings.DATA_DIR);
        logger.info(`Removed data directory`);
      }
      
      logger.info('Local data cleanup completed');
    } catch (error) {
      logger.error(`Error cleaning up local files: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  } else {
    logger.info('No data directory found, nothing to clean up');
  }
} 
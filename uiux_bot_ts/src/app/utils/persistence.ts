/**
 * Persistence utilities for the UI/UX Lesson Bot
 * All data is stored exclusively in Supabase
 */

import { logger } from './logger';
import { getSupabaseClient } from '../../database/supabase-client';
import { settings } from '../config/settings';

// Define subscriber type
export interface Subscriber {
  id: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  joinedAt: string;
  lastActivity: string;
  lessonCount: number;
  quizCount: number;
  isAdmin: boolean;
}

// Define health status type
export interface HealthStatus {
  lastCheckTime: string;
  isHealthy: boolean;
  subscribers: number;
  totalLessonsDelivered: number;
  totalQuizzes: number;
  startupTime: string;
  lastError?: string;
  lastErrorTime?: string;
  version: string;
  nextScheduledLesson?: string;
}

/**
 * Initialize persistence module
 * Verify Supabase connection
 */
export async function initPersistence(): Promise<void> {
  if (!settings.ENABLE_SUPABASE) {
    const errorMessage = 'FATAL ERROR: Supabase must be enabled for data persistence. Set ENABLE_SUPABASE=true in environment.';
    logger.error(errorMessage);
    console.error('\x1b[31m%s\x1b[0m', errorMessage);
    process.exit(1);
  }
  
  try {
    // Verify Supabase connection
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('subscribers').select('count').limit(1);
    
    if (error) {
      const errorMessage = `FATAL ERROR: Supabase connection failed: ${error.message}. Cannot access subscriber data.`;
      logger.error(errorMessage);
      console.error('\x1b[31m%s\x1b[0m', errorMessage);
      process.exit(1);
    }
    
    logger.info('Persistence module initialized with Supabase');
  } catch (error) {
    const errorMessage = `FATAL ERROR: Supabase initialization failed: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(errorMessage);
    console.error('\x1b[31m%s\x1b[0m', errorMessage);
    process.exit(1);
  }
}

/**
 * Convert a database subscriber object to an application subscriber
 */
function fromDbSubscriber(data: any): Subscriber {
  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    username: data.username,
    joinedAt: data.joined_at,
    lastActivity: data.last_activity,
    lessonCount: data.lesson_count,
    quizCount: data.quiz_count,
    isAdmin: data.is_admin
  };
}

/**
 * Convert an application subscriber to a database subscriber object
 */
function toDbSubscriber(subscriber: Subscriber): any {
  return {
    id: subscriber.id,
    first_name: subscriber.firstName,
    last_name: subscriber.lastName,
    username: subscriber.username,
    joined_at: subscriber.joinedAt,
    last_activity: subscriber.lastActivity,
    lesson_count: subscriber.lessonCount,
    quiz_count: subscriber.quizCount,
    is_admin: subscriber.isAdmin
  };
}

/**
 * Log Supabase errors without exiting
 */
function logSupabaseError(operation: string, error: any): void {
  let errorDetails: string;
  
  if (error instanceof Error) {
    errorDetails = error.message;
  } else if (error && typeof error === 'object') {
    try {
      // Try to extract Supabase error details
      errorDetails = JSON.stringify(error, null, 2);
    } catch (e) {
      errorDetails = 'Unable to stringify error object';
    }
  } else {
    errorDetails = String(error);
  }
  
  const errorMessage = `ERROR: Supabase ${operation} failed: ${errorDetails}`;
  logger.error(errorMessage);
  console.error('\x1b[31m%s\x1b[0m', errorMessage);
}

/**
 * Handle Supabase errors with exit (kept for backward compatibility)
 */
function handleSupabaseError(operation: string, error: any): never {
  logSupabaseError(operation, error);
  process.exit(1);
}

/**
 * Get a subscriber by ID
 * @param id The subscriber ID
 * @returns The subscriber or null if not found
 */
export async function getSubscriber(id: number): Promise<Subscriber | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('subscribers')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      logSupabaseError(`getSubscriber for id ${id}`, error);
      return null;
    }
    
    return data ? fromDbSubscriber(data) : null;
  } catch (error) {
    logSupabaseError(`getSubscriber for id ${id}`, error);
    return null;
  }
}

/**
 * Get all subscribers
 * @returns Array of subscribers
 */
export async function getAllSubscribers(): Promise<Subscriber[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('subscribers')
      .select('*')
      .order('last_activity', { ascending: false });
    
    if (error) {
      logSupabaseError('getAllSubscribers', error);
      return [];
    }
    
    return data ? data.map(sub => fromDbSubscriber(sub)) : [];
  } catch (error) {
    logSupabaseError('getAllSubscribers', error);
    return [];
  }
}

/**
 * Create a new subscriber
 * @param subscriber The subscriber data
 * @returns The created subscriber
 */
export async function createSubscriber(subscriber: Subscriber): Promise<Subscriber> {
  try {
    const supabase = getSupabaseClient();
    const dbSubscriber = toDbSubscriber(subscriber);
    
    const { data, error } = await supabase
      .from('subscribers')
      .upsert(dbSubscriber, { onConflict: 'id' })
      .select()
      .single();
    
    if (error) {
      logSupabaseError(`createSubscriber for id ${subscriber.id}`, error);
      return subscriber; // Return the original data so the bot can continue
    }
    
    return data ? fromDbSubscriber(data) : subscriber;
  } catch (error) {
    logSupabaseError(`createSubscriber for id ${subscriber.id}`, error);
    return subscriber; // Return the original data so the bot can continue
  }
}

/**
 * Update a subscriber
 * @param id The subscriber ID
 * @param updates The fields to update
 * @returns The updated subscriber or null if not found
 */
export async function updateSubscriber(id: number, updates: Partial<Subscriber>): Promise<Subscriber | null> {
  try {
    // First get the existing subscriber
    const existing = await getSubscriber(id);
    if (!existing) {
      logger.warn(`Cannot update subscriber ${id} - not found`);
      return null;
    }
    
    const supabase = getSupabaseClient();
    
    // Convert updates to DB format
    const dbUpdates: Record<string, any> = {};
    if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
    if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
    if (updates.username !== undefined) dbUpdates.username = updates.username;
    if (updates.lastActivity !== undefined) dbUpdates.last_activity = updates.lastActivity;
    if (updates.lessonCount !== undefined) dbUpdates.lesson_count = updates.lessonCount;
    if (updates.quizCount !== undefined) dbUpdates.quiz_count = updates.quizCount;
    if (updates.isAdmin !== undefined) dbUpdates.is_admin = updates.isAdmin;
    
    const { data, error } = await supabase
      .from('subscribers')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      logSupabaseError(`updateSubscriber for id ${id}`, error);
      // Return the existing subscriber with applied updates for continuity
      return { ...existing, ...updates };
    }
    
    return data ? fromDbSubscriber(data) : { ...existing, ...updates };
  } catch (error) {
    logSupabaseError(`updateSubscriber for id ${id}`, error);
    const existing = await getSubscriber(id);
    return existing ? { ...existing, ...updates } : null;
  }
}

/**
 * Delete a subscriber
 * @param id The subscriber ID
 * @returns True if successful
 */
export async function deleteSubscriber(id: number): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    
    // First, delete any related records in the subscriber_bots table
    const { error: relatedError } = await supabase
      .from('subscriber_bots')
      .delete()
      .eq('subscriber_id', id);
    
    if (relatedError) {
      logSupabaseError(`deleteSubscriber (related records) for id ${id}`, relatedError);
      // Continue anyway and try to delete the subscriber
    }
    
    // Then delete the subscriber
    const { error } = await supabase
      .from('subscribers')
      .delete()
      .eq('id', id);
    
    if (error) {
      logSupabaseError(`deleteSubscriber for id ${id}`, error);
      return false;
    }
    
    return true;
  } catch (error) {
    logSupabaseError(`deleteSubscriber for id ${id}`, error);
    return false;
  }
}

/**
 * Increment the lesson count for a user
 * @param userId The user ID
 */
export async function incrementLessonCount(userId: number): Promise<void> {
  try {
    const subscriber = await getSubscriber(userId);
    if (!subscriber) {
      logger.warn(`Cannot increment lesson count for user ${userId} - not found`);
      return;
    }
    
    await updateSubscriber(userId, {
      lessonCount: subscriber.lessonCount + 1,
      lastActivity: new Date().toISOString()
    });
  } catch (error) {
    logSupabaseError(`incrementLessonCount for user ${userId}`, error);
    // Continue execution even on error
  }
}

/**
 * Increment the quiz count for a user
 * @param userId The user ID
 */
export async function incrementQuizCount(userId: number): Promise<void> {
  try {
    const subscriber = await getSubscriber(userId);
    if (!subscriber) {
      logger.warn(`Cannot increment quiz count for user ${userId} - not found`);
      return;
    }
    
    await updateSubscriber(userId, {
      quizCount: subscriber.quizCount + 1,
      lastActivity: new Date().toISOString()
    });
  } catch (error) {
    logSupabaseError(`incrementQuizCount for user ${userId}`, error);
    // Continue execution even on error
  }
}

/**
 * Get the health status
 * @returns The health status or null if not found
 */
export async function getHealthStatus(): Promise<HealthStatus | null> {
  try {
    const supabase = getSupabaseClient();
    
    // Try both possible table names
    let data;
    let error;
    
    // First try health_status table
    const healthStatusResult = await supabase
      .from('health_status')
      .select('*')
      .order('last_check_time', { ascending: false })
      .limit(1)
      .single();
    
    if (!healthStatusResult.error) {
      data = healthStatusResult.data;
    } else {
      // If health_status failed, try health table
      const healthResult = await supabase
        .from('health')
        .select('*')
        .order('last_check_time', { ascending: false })
        .limit(1)
        .single();
      
      data = healthResult.data;
      error = healthResult.error;
    }
    
    // If no data exists, create a default health status
    if (!data) {
      const defaultHealth: HealthStatus = {
        lastCheckTime: new Date().toISOString(),
        isHealthy: true,
        subscribers: 0,
        totalLessonsDelivered: 0,
        totalQuizzes: 0,
        startupTime: new Date().toISOString(),
        version: '1.0.0'
      };
      
      // Try to insert into health_status first
      const insertResult = await supabase
        .from('health_status')
        .insert([{
          id: 1,
          last_check_time: defaultHealth.lastCheckTime,
          is_healthy: defaultHealth.isHealthy,
          subscribers: defaultHealth.subscribers,
          total_lessons_delivered: defaultHealth.totalLessonsDelivered,
          total_quizzes: defaultHealth.totalQuizzes,
          startup_time: defaultHealth.startupTime,
          version: defaultHealth.version
        }])
        .select()
        .single();
      
      if (!insertResult.error) {
        data = insertResult.data;
      } else {
        // If health_status insert failed, try health table
        const healthInsertResult = await supabase
          .from('health')
          .insert([{
            last_check_time: defaultHealth.lastCheckTime,
            is_healthy: defaultHealth.isHealthy,
            subscribers: defaultHealth.subscribers,
            total_lessons_delivered: defaultHealth.totalLessonsDelivered,
            total_quizzes: defaultHealth.totalQuizzes,
            startup_time: defaultHealth.startupTime,
            version: defaultHealth.version
          }])
          .select()
          .single();
        
        data = healthInsertResult.data;
        error = healthInsertResult.error;
      }
    }
    
    if (error) {
      logSupabaseError('getHealthStatus', error);
      return null;
    }
    
    if (!data) return null;
    
    return {
      lastCheckTime: data.last_check_time,
      isHealthy: data.is_healthy,
      subscribers: data.subscribers,
      totalLessonsDelivered: data.total_lessons_delivered,
      totalQuizzes: data.total_quizzes,
      startupTime: data.startup_time,
      lastError: data.last_error,
      lastErrorTime: data.last_error_time,
      version: data.version,
      nextScheduledLesson: data.next_scheduled_lesson
    };
  } catch (error) {
    logSupabaseError('getHealthStatus', error);
    return null;
  }
}

/**
 * Update the health status
 * @param health The health status to save
 * @returns The saved health status
 */
export async function updateHealthStatus(health: HealthStatus): Promise<HealthStatus> {
  try {
    const supabase = getSupabaseClient();
    
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
    
    // Try both possible table names
    let data;
    let error;
    
    // First try health_status table
    const healthStatusResult = await supabase
      .from('health_status')
      .upsert(healthDb, { onConflict: 'id' })
      .select()
      .single();
    
    if (!healthStatusResult.error) {
      data = healthStatusResult.data;
    } else {
      // If health_status failed, try health table
      const healthResult = await supabase
        .from('health')
        .upsert(healthDb)
        .select()
        .single();
      
      data = healthResult.data;
      error = healthResult.error;
    }
    
    if (error) {
      logSupabaseError('updateHealthStatus', error);
      return health; // Return the original data so the bot can continue
    }
    
    if (!data) {
      logSupabaseError('updateHealthStatus', new Error('No data returned after update'));
      return health; // Return the original data so the bot can continue
    }
    
    return {
      lastCheckTime: data.last_check_time,
      isHealthy: data.is_healthy,
      subscribers: data.subscribers,
      totalLessonsDelivered: data.total_lessons_delivered,
      totalQuizzes: data.total_quizzes,
      startupTime: data.startup_time,
      lastError: data.last_error,
      lastErrorTime: data.last_error_time,
      version: data.version,
      nextScheduledLesson: data.next_scheduled_lesson
    };
  } catch (error) {
    logSupabaseError('updateHealthStatus', error);
    return health; // Return the original data so the bot can continue
  }
} 
/**
 * Lesson Repository
 * 
 * Manages lesson data exclusively in Supabase without any caching.
 * Every operation directly reads from or writes to the database.
 */

import { logger } from './logger';
import { settings } from '../config/settings';
import { getSupabaseClient } from '../../database/supabase-client';
import { LessonData } from './lesson-types';
import { PoolType } from '../api/batch-processor';

// Supabase DB model
interface LessonDBModel {
  id: string;
  theme: string;
  title: string;
  content: string;
  vocabulary: string;
  has_vocabulary: boolean;
  created_at: string;
  quiz_question?: string;
  quiz_options?: string[];
  quiz_correct_index?: number;
  explanation?: string;
  option_explanations?: string[];
  image_url?: string;
  example_link: string;
  video_query: string;
  pool_type?: PoolType;
  is_used?: boolean;
  used_at?: string;
  batch_id?: string;
}

/**
 * Repository for managing lesson data exclusively in Supabase without caching
 */
export class LessonRepository {
  constructor() {
    // Verify Supabase is enabled
    if (!settings.ENABLE_SUPABASE) {
      const errorMessage = 'FATAL ERROR: Supabase must be enabled for lesson persistence. Set ENABLE_SUPABASE=true in environment.';
      logger.error(errorMessage);
      console.error('\x1b[31m%s\x1b[0m', errorMessage);
      process.exit(1); // Exit with error code
    }
    
    // Verify Supabase connection
    this.verifySupabaseConnection();
  }
  
  /**
   * Verify Supabase connection works
   */
  private async verifySupabaseConnection(): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('lessons').select('count').limit(1);
      
      if (error) {
        const errorMessage = `FATAL ERROR: Supabase connection failed: ${error.message}. Lesson persistence requires Supabase.`;
        logger.error(errorMessage);
        console.error('\x1b[31m%s\x1b[0m', errorMessage);
        process.exit(1); // Exit with error code
      }
      
      logger.info('Supabase connection verified for lesson persistence');
    } catch (error) {
      const errorMessage = `FATAL ERROR: Supabase connection failed: ${error instanceof Error ? error.message : String(error)}. Lesson persistence requires Supabase.`;
      logger.error(errorMessage);
      console.error('\x1b[31m%s\x1b[0m', errorMessage);
      process.exit(1); // Exit with error code
    }
  }
  
  /**
   * Map from DB model to app model
   */
  private fromDbModel(dbModel: LessonDBModel): LessonData {
    // Parse example_link from string to object if it exists
    let example_link;
    try {
      if (dbModel.example_link && dbModel.example_link !== '') {
        example_link = JSON.parse(dbModel.example_link);
      }
    } catch (error) {
      logger.warn(`Failed to parse example_link for lesson ${dbModel.id}: ${error instanceof Error ? error.message : String(error)}`);
      example_link = undefined;
    }

    // Parse video_query from string to array if it exists
    let videoQuery;
    try {
      if (dbModel.video_query && dbModel.video_query !== '') {
        videoQuery = JSON.parse(dbModel.video_query);
      }
    } catch (error) {
      logger.warn(`Failed to parse video_query for lesson ${dbModel.id}: ${error instanceof Error ? error.message : String(error)}`);
      videoQuery = undefined;
    }
    
    return {
      id: dbModel.id,
      title: dbModel.title,
      content: dbModel.content,
      vocabulary: dbModel.vocabulary,
      hasVocabulary: dbModel.has_vocabulary,
      createdAt: dbModel.created_at,
      theme:dbModel.theme,
      quizQuestion: dbModel.quiz_question,
      quizOptions: dbModel.quiz_options,
      quizCorrectIndex: dbModel.quiz_correct_index,
      explanation: dbModel.explanation,
      optionExplanations: dbModel.option_explanations,
      imageUrl: dbModel.image_url,
      example_link: example_link,
      videoQuery: videoQuery,
      pool_type: dbModel.pool_type,
      is_used: dbModel.is_used,
      used_at: dbModel.used_at,
      batch_id: dbModel.batch_id
    };
  }
  
  /**
   * Convert app model to database model
   * @param appModel The app model to convert
   * @returns The database model
   */
  private toDbModel(appModel: LessonData): LessonDBModel {
    try {
      // Log the input data
      logger.debug(`Converting lesson to DB model: ${JSON.stringify(appModel, null, 2)}`);
      
      // Serialize example_link to JSON string if it exists
      let example_link_str = '';
      if (appModel.example_link) {
        try {
          example_link_str = JSON.stringify(appModel.example_link);
        } catch (error) {
          logger.warn(`Failed to stringify example_link for lesson ${appModel.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Serialize videoQuery to JSON string if it exists
      let video_query_str = '';
      if (appModel.videoQuery && Array.isArray(appModel.videoQuery)) {
        try {
          video_query_str = JSON.stringify(appModel.videoQuery);
        } catch (error) {
          logger.warn(`Failed to stringify videoQuery for lesson ${appModel.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      const dbModel: LessonDBModel = {
        id: appModel.id,
        theme: appModel.theme,
        title: appModel.title,
        content: appModel.content,
        vocabulary: appModel.vocabulary,
        has_vocabulary: appModel.hasVocabulary,
        created_at: appModel.createdAt,
        quiz_question: appModel.quizQuestion,
        quiz_options: appModel.quizOptions,
        quiz_correct_index: appModel.quizCorrectIndex,
        explanation: appModel.explanation,
        option_explanations: appModel.optionExplanations,
        image_url: appModel.imageUrl,
        example_link: example_link_str,
        video_query: video_query_str,
        pool_type: appModel.pool_type,
        is_used: appModel.is_used,
        used_at: appModel.used_at,
        batch_id: appModel.batch_id
      };
      
      // Log the output data
      logger.debug(`Converted DB model: ${JSON.stringify(dbModel, null, 2)}`);
      
      return dbModel;
    } catch (error) {
      logger.error(`Error converting lesson to DB model: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Save a lesson to the database
   * @param lesson The lesson to save
   * @returns The saved lesson
   */
  async saveLesson(lesson: LessonData): Promise<LessonData> {
    try {
      const supabase = getSupabaseClient();
      const dbModel = this.toDbModel(lesson);
      
      // Log the lesson data being saved
      logger.info(`Saving lesson with ID ${lesson.id} to database`);
      logger.debug(`Lesson data: ${JSON.stringify(dbModel, null, 2)}`);
      
      const { data, error } = await supabase
        .from('lessons')
        .upsert(dbModel, { onConflict: 'id' });
      
      if (error) {
        this.logSupabaseError(`saveLesson for id ${lesson.id}`, error);
        throw error;
      }
      
      logger.info(`Successfully saved lesson with ID ${lesson.id}`);
      return lesson;
    } catch (error) {
      this.logSupabaseError(`saveLesson for id ${lesson.id}`, error);
      throw error;
    }
  }
  
  /**
   * Get available lessons from a pool
   * @param poolType The pool type to get lessons from
   * @param limit Maximum number of lessons to return
   * @returns Array of available lessons
   */
  async getAvailableLessonsFromPool(poolType: PoolType, limit: number = 10): Promise<LessonData[]> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('pool_type', poolType)
        .eq('is_used', false)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        this.logSupabaseError(`getAvailableLessonsFromPool for ${poolType}`, error);
        return [];
      }
      
      if (!data || data.length === 0) {
        logger.info(`No available lessons found in ${poolType} pool`);
        return [];
      }
      
      logger.info(`Found ${data.length} available lessons in ${poolType} pool`);
      return data.map(lesson => this.fromDbModel(lesson as LessonDBModel));
    } catch (error) {
      this.logSupabaseError(`getAvailableLessonsFromPool for ${poolType}`, error);
      return [];
    }
  }
  
  /**
   * Mark a lesson as used
   * @param lessonId The ID of the lesson to mark as used
   * @returns The updated lesson or null if not found
   */
  async markLessonAsUsed(lessonId: string): Promise<LessonData | null> {
    try {
      const supabase = getSupabaseClient();
      
      // Update the lesson status
      const { data, error } = await supabase
        .from('lessons')
        .update({
          is_used: true,
          used_at: new Date().toISOString()
        })
        .eq('id', lessonId)
        .select('*')
        .single();
      
      if (error) {
        this.logSupabaseError(`markLessonAsUsed for ${lessonId}`, error);
        return null;
      }
      
      if (!data) {
        logger.warn(`Lesson with ID ${lessonId} not found for marking as used`);
        return null;
      }
      
      logger.info(`Successfully marked lesson ${lessonId} as used`);
      return this.fromDbModel(data as LessonDBModel);
    } catch (error) {
      this.logSupabaseError(`markLessonAsUsed for ${lessonId}`, error);
      return null;
    }
  }
  
  /**
   * Get pool statistics
   * @param poolType The pool type to get statistics for
   * @returns Pool statistics or null if not found
   */
  async getPoolStats(poolType: PoolType): Promise<{
    total_lessons: number;
    available_lessons: number;
    last_generated: string;
  } | null> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('lesson_pool_stats')
        .select('total_lessons, available_lessons, last_generated')
        .eq('pool_type', poolType)
        .single();
      
      if (error) {
        this.logSupabaseError(`getPoolStats for ${poolType}`, error);
        return null;
      }
      
      if (!data) {
        logger.info(`No pool stats found for ${poolType}`);
        return null;
      }
      
      return data;
    } catch (error) {
      this.logSupabaseError(`getPoolStats for ${poolType}`, error);
      return null;
    }
  }
  
  /**
   * Get a lesson by ID
   * @param id The lesson ID
   * @returns The lesson or null if not found
   */
  async getLessonById(id: string): Promise<LessonData | null> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        this.logSupabaseError(`getLessonById for id ${id}`, error);
        return null;
      }
      
      return data ? this.fromDbModel(data as LessonDBModel) : null;
    } catch (error) {
      this.logSupabaseError(`getLessonById for id ${id}`, error);
      return null;
    }
  }
  
  /**
   * Get lessons by theme
   * @param theme The theme to search for
   * @returns Array of lessons
   */
  async getLessonsByTheme(theme: string): Promise<LessonData[]> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('theme', theme);
      
      if (error) {
        this.logSupabaseError(`getLessonsByTheme for theme ${theme}`, error);
        return [];
      }
      
      return data ? data.map(lesson => this.fromDbModel(lesson as LessonDBModel)) : [];
    } catch (error) {
      this.logSupabaseError(`getLessonsByTheme for theme ${theme}`, error);
      return [];
    }
  }
  
  /**
   * Get recent themes to avoid duplication
   * @param limit Number of recent themes to get
   * @returns Array of recent themes
   */
  async getRecentThemes(limit: number = 10): Promise<string[]> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('lessons')
        .select('theme')
        .order('created_at', { ascending: false })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(limit);
      
      if (error) {
        this.logSupabaseError('getRecentThemes', error);
        return [];
      }
      
      if (!data || data.length === 0) {
        return [];
      }
      
      const uniqueThemes = Array.from(new Set(data.map(item => item.theme)));
      return uniqueThemes;
    } catch (error) {
      this.logSupabaseError('getRecentThemes', error);
      return [];
    }
  }
  
  /**
   * Get recent quizzes to avoid duplication
   * @param limit Number of recent quizzes to get
   * @returns Array of recent quiz questions
   */
  async getRecentQuizzes(limit: number = 10): Promise<string[]> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('lessons')
        .select('quiz_question')
        .order('created_at', { ascending: false })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(limit);
      
      if (error) {
        this.logSupabaseError('getRecentQuizzes', error);
        return [];
      }
      
      if (!data || data.length === 0) {
        return [];
      }
      
      // Filter out empty quizzes and get unique questions
      const validQuizzes = data
        .filter(item => item.quiz_question && item.quiz_question.length > 0)
        .map(item => item.quiz_question as string);
      
      const uniqueQuizzes = Array.from(new Set(validQuizzes));
      return uniqueQuizzes;
    } catch (error) {
      this.logSupabaseError('getRecentQuizzes', error);
      return [];
    }
  }
  
  /**
   * Track lesson delivery to a subscriber
   * @param subscriberId The subscriber ID
   * @param lessonId The lesson ID
   * @param source Optional source of the lesson (e.g., 'scheduled', 'on-demand')
   */
  async trackLessonDelivery(subscriberId: string | number, lessonId: string, source?: string): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      // Check if the table exists first - using the correct table name lesson_delivery
      const { error: checkError } = await supabase
        .from('lesson_delivery')
        .select('id')
        .limit(1);
      
      // If the table doesn't exist, log a warning but don't fail
      if (checkError && checkError.code === '42P01') { // Table doesn't exist
        logger.warn(`Cannot track lesson delivery because 'lesson_delivery' table does not exist.`);
        return;
      }
      
      // Convert subscriberId to number if it's a string (user_id is bigint)
      const userId = typeof subscriberId === 'string' ? parseInt(subscriberId, 10) : subscriberId;
      
      // Insert a record in the delivery tracking table with the correct column names
      const { error } = await supabase
        .from('lesson_delivery')
        .insert({
          user_id: userId,
          lesson_id: lessonId,
          delivered_at: new Date().toISOString(),
          source: source || 'bot'
        });
      
      if (error) {
        this.logSupabaseError(`trackLessonDelivery for subscriber ${subscriberId} and lesson ${lessonId}`, error);
      }
    } catch (error) {
      this.logSupabaseError(`trackLessonDelivery for subscriber ${subscriberId} and lesson ${lessonId}`, error);
    }
  }
  
  /**
   * Get a random lesson, optionally by theme
   * @param theme Optional theme to filter by
   * @returns A random lesson or null if none found
   */
  async getRandomLesson(theme?: string): Promise<LessonData | null> {
    try {
      const supabase = getSupabaseClient();
      let query = supabase.from('lessons').select('*');
      
      if (theme) {
        query = query.eq('theme', theme);
      }
      
      const { data, error } = await query;
      
      if (error) {
        this.logSupabaseError(`getRandomLesson ${theme ? `for theme ${theme}` : ''}`, error);
        return null;
      }
      
      if (!data || data.length === 0) {
        logger.info(`No lessons found ${theme ? `for theme ${theme}` : ''}`);
        return null;
      }
      
      const randomIndex = Math.floor(Math.random() * data.length);
      return this.fromDbModel(data[randomIndex] as LessonDBModel);
    } catch (error) {
      this.logSupabaseError(`getRandomLesson ${theme ? `for theme ${theme}` : ''}`, error);
      return null;
    }
  }
  
  /**
   * Get a count of lessons
   * @returns Total number of lessons
   */
  async getLessonCount(): Promise<number> {
    try {
      const supabase = getSupabaseClient();
      const { count, error } = await supabase
        .from('lessons')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        this.logSupabaseError('getLessonCount', error);
        return 0;
      }
      
      return count || 0;
    } catch (error) {
      this.logSupabaseError('getLessonCount', error);
      return 0;
    }
  }
  
  /**
   * Log Supabase error with context
   * @param context Context or operation where the error occurred
   * @param error The Supabase error object
   */
  private logSupabaseError(context: string, error: any): void {
    const errorMessage = error instanceof Error ? error.message : 
      (error?.message || error?.error_description || String(error));
    logger.error(`Supabase error in ${context}: ${errorMessage}`);
    
    if (error?.code) {
      logger.error(`Supabase error code: ${error.code}`);
    }
    
    if (error?.details) {
      logger.error(`Supabase error details: ${error.details}`);
    }
  }
}

// Export a singleton instance
export const lessonRepository = new LessonRepository(); 
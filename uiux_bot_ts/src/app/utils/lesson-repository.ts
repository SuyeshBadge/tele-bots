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
  example_link?: {
    url: string;
    description: string;
  };
  video_query?: string[];
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
      example_link: dbModel.example_link,
      videoQuery: dbModel.video_query
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
        example_link: appModel.example_link,
        video_query: appModel.videoQuery
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
   * Log Supabase errors with proper formatting
   */
  private logSupabaseError(operation: string, error: any): void {
    const errorMessage = `Supabase error in ${operation}: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(errorMessage);
    
    // Log additional details if available
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    
    // Log Supabase-specific error details
    if (error && typeof error === 'object') {
      if (error.code) {
        logger.error(`Error code: ${error.code}`);
      }
      if (error.details) {
        logger.error(`Error details: ${error.details}`);
      }
      if (error.hint) {
        logger.error(`Error hint: ${error.hint}`);
      }
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
   * Get the most recent lessons
   * @param limit Maximum number of lessons to return
   * @returns Array of lessons
   */
  async getRecentLessons(limit: number = 10): Promise<LessonData[]> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        this.logSupabaseError('getRecentLessons', error);
        return [];
      }
      
      return data ? data.map(lesson => this.fromDbModel(lesson as LessonDBModel)) : [];
    } catch (error) {
      this.logSupabaseError('getRecentLessons', error);
      return [];
    }
  }
  
  /**
   * Delete a lesson
   * @param id The lesson ID
   * @returns True if deleted, false otherwise
   */
  async deleteLesson(id: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', id);
      
      if (error) {
        this.logSupabaseError(`deleteLesson for id ${id}`, error);
        return false;
      }
      
      logger.info(`Deleted lesson with ID ${id} from Supabase`);
      return true;
    } catch (error) {
      this.logSupabaseError(`deleteLesson for id ${id}`, error);
      return false;
    }
  }
  
  /**
   * Track a lesson delivery to a user
   * @param userId The user ID
   * @param lessonId The lesson ID
   * @returns True if successful
   */
  async trackLessonDelivery(userId: number, lessonId: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const deliveryData = {
        user_id: userId,
        lesson_id: lessonId,
        delivered_at: new Date().toISOString(),
        source: 'bot'
      };
      
      // Try first table name: lesson_delivery
      let result = await supabase
        .from('lesson_delivery')
        .insert(deliveryData);
      
      // If that fails, try alternative table: user_lessons
      if (result.error && result.error.code === '42P01') {
        logger.info('Trying alternative table name for lesson delivery tracking');
        result = await supabase
          .from('user_lessons')
          .insert(deliveryData);
      }
      
      if (result.error) {
        this.logSupabaseError(`trackLessonDelivery for user ${userId}, lesson ${lessonId}`, result.error);
        return false;
      }
      
      logger.info(`Tracked lesson ${lessonId} delivery to user ${userId}`);
      return true;
    } catch (error) {
      this.logSupabaseError(`trackLessonDelivery for user ${userId}, lesson ${lessonId}`, error);
      return false;
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
   * Handle Supabase errors with exit
   */
  private handleSupabaseError(operation: string, error: any): never {
    return this.logSupabaseError(operation, error) as never;
  }
  
  /**
   * Get recent lesson deliveries for a specific user
   * @param userId The user ID
   * @param limit Maximum number of deliveries to return
   * @returns Array of lesson delivery records
   */
  async getUserRecentLessonDeliveries(userId: number, limit: number = 10): Promise<{ userId: number; lessonId: string; deliveredAt: string }[]> {
    try {
      const supabase = getSupabaseClient();
      
      // Try first with lesson_delivery table
      let result = await supabase
        .from('lesson_delivery')
        .select('user_id, lesson_id, delivered_at')
        .eq('user_id', userId)
        .order('delivered_at', { ascending: false })
        .limit(limit);
      
      // If that fails, try with user_lessons table
      if (result.error && result.error.code === '42P01') {
        result = await supabase
          .from('user_lessons')
          .select('user_id, lesson_id, delivered_at')
          .eq('user_id', userId)
          .order('delivered_at', { ascending: false })
          .limit(limit);
      }
      
      if (result.error) {
        this.logSupabaseError(`getUserRecentLessonDeliveries for user ${userId}`, result.error);
        return [];
      }
      
      return result.data ? result.data.map(item => ({
        userId: item.user_id,
        lessonId: item.lesson_id,
        deliveredAt: item.delivered_at
      })) : [];
    } catch (error) {
      this.logSupabaseError(`getUserRecentLessonDeliveries for user ${userId}`, error);
      return [];
    }
  }
  
  /**
   * Get themes from lessons created in the last month
   * @returns Array of unique themes
   */
  async getRecentThemes(): Promise<string[]> {
    try {
      const supabase = getSupabaseClient();
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      const { data, error } = await supabase
        .from('lessons')
        .select('theme')
        .gte('created_at', oneMonthAgo.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) {
        this.logSupabaseError('getRecentThemes', error);
        return [];
      }
      
      // Extract unique themes
      const themes = data ? [...new Set(data.map(lesson => lesson.theme))] : [];
      return themes;
    } catch (error) {
      this.logSupabaseError('getRecentThemes', error);
      return [];
    }
  }

  /**
   * Get recent quizzes from lessons created in the last month
   * @returns Array of unique quizzes
   */
  async getRecentQuizzes(): Promise<string[]> {
    try {
      const supabase = getSupabaseClient();
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      const { data, error } = await supabase
        .from('lessons')
        .select('quiz_question')
        .gte('created_at', oneMonthAgo.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) {
        this.logSupabaseError('getRecentQuizzes', error);
        return [];
      }
      
      // Extract unique quizzes
      const quizzes = data ? [...new Set(data.map(lesson => lesson.quiz_question))] : [];
      return quizzes;
    } catch (error) {
      this.logSupabaseError('getRecentQuizzes', error);
      return [];
    }
  }
}

// Export a singleton instance
export const lessonRepository = new LessonRepository(); 
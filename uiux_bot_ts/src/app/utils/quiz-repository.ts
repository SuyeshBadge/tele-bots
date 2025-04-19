/**
 * Quiz Repository
 * 
 * Manages quiz data exclusively in Supabase without any caching.
 * Every operation directly reads from or writes to the database.
 */

import { logger } from './logger';
import { settings } from '../config/settings';
import { getSupabaseClient } from '../../database/supabase-client';

// Define the quiz data structure
export interface QuizData {
  pollId: string;
  lessonId: string;
  quizId: string;
  correctOption: number;
  question: string;
  options: string[];
  theme?: string;
  explanation?: string;
  option_explanations?: string[];
  createdAt: string;
  expiresAt: string;
}

// Supabase DB model
interface QuizDBModel {
  poll_id: string;
  lesson_id: string;
  quiz_id: string;
  correct_option: number;
  question: string;
  options: string[];
  theme?: string;
  explanation?: string;
  option_explanations?: string[];
  created_at: string;
  expires_at: string;
}

/**
 * Repository for managing quiz data exclusively in Supabase without caching
 */
export class QuizRepository {
  constructor() {
    // Verify Supabase is enabled
    if (!settings.ENABLE_SUPABASE) {
      const errorMessage = 'FATAL ERROR: Supabase must be enabled for quiz persistence. Set ENABLE_SUPABASE=true in environment.';
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
      const { error } = await supabase.from('quizzes').select('count').limit(1);
      
      if (error) {
        const errorMessage = `FATAL ERROR: Supabase connection failed: ${error.message}. Quiz persistence requires Supabase.`;
        logger.error(errorMessage);
        console.error('\x1b[31m%s\x1b[0m', errorMessage);
        process.exit(1); // Exit with error code
      }
      
      logger.info('Supabase connection verified for quiz persistence');
    } catch (error) {
      const errorMessage = `FATAL ERROR: Supabase connection failed: ${error instanceof Error ? error.message : String(error)}. Quiz persistence requires Supabase.`;
      logger.error(errorMessage);
      console.error('\x1b[31m%s\x1b[0m', errorMessage);
      process.exit(1); // Exit with error code
    }
  }
  
  /**
   * Map from DB model to app model
   */
  private fromDbModel(dbModel: QuizDBModel): QuizData {
    return {
      pollId: dbModel.poll_id,
      lessonId: dbModel.lesson_id,
      quizId: dbModel.quiz_id,
      correctOption: dbModel.correct_option,
      question: dbModel.question,
      options: dbModel.options,
      theme: dbModel.theme,
      explanation: dbModel.explanation,
      option_explanations: dbModel.option_explanations,
      createdAt: dbModel.created_at,
      expiresAt: dbModel.expires_at
    };
  }
  
  /**
   * Map from app model to DB model
   */
  private toDbModel(appModel: QuizData): QuizDBModel {
    return {
      poll_id: appModel.pollId,
      lesson_id: appModel.lessonId,
      quiz_id: appModel.quizId,
      correct_option: appModel.correctOption,
      question: appModel.question,
      options: appModel.options,
      theme: appModel.theme,
      explanation: appModel.explanation,
      option_explanations: appModel.option_explanations,
      created_at: appModel.createdAt,
      expires_at: appModel.expiresAt
    };
  }
  
  /**
   * Log Supabase errors without exiting
   */
  private logSupabaseError(operation: string, error: any): void {
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
  private handleSupabaseError(operation: string, error: any): never {
    this.logSupabaseError(operation, error);
    return undefined as never;
  }
  
  /**
   * Save a quiz
   * @param quiz The quiz to save
   * @returns The saved quiz
   */
  async saveQuiz(quiz: QuizData): Promise<QuizData> {
    try {
      const supabase = getSupabaseClient();
      const dbQuiz = this.toDbModel(quiz);
      
      const { error } = await supabase
        .from('quizzes')
        .upsert(dbQuiz, { onConflict: 'poll_id' });
      
      if (error) {
        this.logSupabaseError(`saveQuiz for poll ${quiz.pollId}`, error);
        return quiz; // Return the quiz anyway so the bot can continue
      }
      
      logger.info(`Saved quiz with poll ID ${quiz.pollId} to Supabase`);
      return quiz;
    } catch (error) {
      this.logSupabaseError(`saveQuiz for poll ${quiz.pollId}`, error);
      return quiz; // Return the quiz anyway so the bot can continue
    }
  }
  
  /**
   * Get a quiz by poll ID
   * @param pollId The poll ID
   * @returns The quiz or null if not found
   */
  async getQuizByPollId(pollId: string): Promise<QuizData | null> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('poll_id', pollId)
        .single();
      
      if (error) {
        this.logSupabaseError(`getQuizByPollId for poll ${pollId}`, error);
        return null;
      }
      
      return data ? this.fromDbModel(data as QuizDBModel) : null;
    } catch (error) {
      this.logSupabaseError(`getQuizByPollId for poll ${pollId}`, error);
      return null;
    }
  }
  
  /**
   * Delete a quiz
   * @param pollId The poll ID
   * @returns True if successful
   */
  async deleteQuiz(pollId: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('poll_id', pollId);
      
      if (error) {
        this.logSupabaseError(`deleteQuiz for poll ${pollId}`, error);
        return false;
      }
      
      logger.info(`Deleted quiz with poll ID ${pollId} from Supabase`);
      return true;
    } catch (error) {
      this.logSupabaseError(`deleteQuiz for poll ${pollId}`, error);
      return false;
    }
  }
  
  /**
   * Cleanup expired quizzes
   * @returns Number of deleted quizzes
   */
  async cleanupExpiredQuizzes(): Promise<number> {
    try {
      const supabase = getSupabaseClient();
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('quizzes')
        .delete()
        .lt('expires_at', now)
        .select('poll_id');
      
      if (error) {
        this.logSupabaseError('cleanupExpiredQuizzes', error);
        return 0;
      }
      
      const count = data?.length || 0;
      logger.info(`Cleaned up ${count} expired quizzes`);
      return count;
    } catch (error) {
      this.logSupabaseError('cleanupExpiredQuizzes', error);
      return 0;
    }
  }
  
  /**
   * Get quizzes that were sent but not answered within a certain timeframe
   * @param minMinutes Minimum minutes since quiz was sent
   * @param maxHours Maximum hours since quiz was sent
   * @returns Array of unanswered quizzes with user IDs
   */
  async getUnansweredQuizzes(minMinutes: number = 30, maxHours: number = 24): Promise<Array<{
    pollId: string;
    question: string;
    theme: string;
    userId: number;
    createdAt: string;
    sentAt: string;
  }>> {
    try {
      const supabase = getSupabaseClient();
      
      // Calculate time range
      const now = new Date();
      const minTime = new Date(now);
      minTime.setMinutes(now.getMinutes() - minMinutes);
      
      const maxTime = new Date(now);
      maxTime.setHours(now.getHours() - maxHours);
      
      // First, get quizzes that are within the time range
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('poll_id, question, theme, created_at')
        .gt('created_at', maxTime.toISOString())  // Less than maxHours old
        .lt('created_at', minTime.toISOString())  // At least minMinutes old
        .order('created_at', { ascending: false }); // Sort by newest first
      
      if (quizError || !quizData || quizData.length === 0) {
        if (quizError) {
          this.logSupabaseError('getUnansweredQuizzes - quiz fetch', quizError);
        }
        return [];
      }
      
      // Get quiz deliveries to find out which users received these quizzes
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('quiz_deliveries')
        .select('poll_id, user_id, answered, delivered_at')
        .in('poll_id', quizData.map(q => q.poll_id))
        .eq('answered', false)
        .order('delivered_at', { ascending: false }); // Sort by most recently delivered first
      
      if (deliveryError) {
        this.logSupabaseError('getUnansweredQuizzes - delivery fetch', deliveryError);
        return [];
      }
      
      // Combine the data
      const unansweredQuizzes = deliveryData?.map(delivery => {
        const quizInfo = quizData.find(q => q.poll_id === delivery.poll_id);
        return {
          pollId: delivery.poll_id,
          userId: delivery.user_id,
          question: quizInfo?.question || 'UI/UX Quiz',
          theme: quizInfo?.theme || 'UI/UX Design',
          createdAt: quizInfo?.created_at || new Date().toISOString(),
          sentAt: delivery.delivered_at 
        };
      }) || [];
      
      logger.info(`Found ${unansweredQuizzes.length} unanswered quizzes to remind users about`);
      return unansweredQuizzes;
    } catch (error) {
      this.logSupabaseError('getUnansweredQuizzes', error);
      return [];
    }
  }

  async getQuizByLessonId(lessonId: string): Promise<QuizData | null> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('lesson_id', lessonId)
        .single();

      if (error) {
        this.logSupabaseError('getQuizByLessonId', error);
        return null;
      }

      if (!data) {
        logger.info(`No quiz found for lesson ID: ${lessonId}`);
        return null;
      }

      // Convert DB model to QuizData interface
      return {
        pollId: data.poll_id,
        lessonId: data.lesson_id,
        quizId: data.quiz_id,
        correctOption: data.correct_option,
        question: data.question,
        options: data.options,
        theme: data.theme,
        explanation: data.explanation,
        option_explanations: data.option_explanations,
        createdAt: data.created_at,
        expiresAt: data.expires_at
      };
    } catch (error) {
      this.logSupabaseError('getQuizByLessonId', error);
      return null;
    }
  }

}

// Export a singleton instance
export const quizRepository = new QuizRepository(); 
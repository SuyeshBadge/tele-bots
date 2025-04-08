/**
 * Quiz Delivery Repository
 * 
 * Manages quiz delivery data in Supabase.
 * Tracks which users have received and answered quizzes.
 */

import { logger } from './logger';
import { settings } from '../config/settings';
import { getSupabaseClient } from '../../database/supabase-client';
import { QuizDeliveryData, QuizDeliveryDBModel, fromQuizDeliveryDbModel, toQuizDeliveryDbModel } from './quiz-types';

/**
 * Repository for managing quiz delivery data
 */
export class QuizDeliveryRepository {
  constructor() {
    // Verify Supabase is enabled
    if (!settings.ENABLE_SUPABASE) {
      const errorMessage = 'FATAL ERROR: Supabase must be enabled for quiz delivery tracking. Set ENABLE_SUPABASE=true in environment.';
      logger.error(errorMessage);
      console.error('\x1b[31m%s\x1b[0m', errorMessage);
      process.exit(1); // Exit with error code
    }
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
   * Track that a quiz was delivered to a user
   * @param userId User ID the quiz was delivered to
   * @param pollId Poll ID of the delivered quiz
   * @returns The created delivery record
   */
  async trackQuizDelivery(userId: number, pollId: string): Promise<QuizDeliveryData | null> {
    try {
      const supabase = getSupabaseClient();
      
      const deliveryData: QuizDeliveryData = {
        pollId,
        userId,
        deliveredAt: new Date().toISOString(),
        answered: false
      };
      
      const dbModel = toQuizDeliveryDbModel(deliveryData);
      
      const { data, error } = await supabase
        .from('quiz_deliveries')
        .upsert(dbModel, { onConflict: 'poll_id,user_id' })
        .select()
        .single();
      
      if (error) {
        this.logSupabaseError(`trackQuizDelivery for poll ${pollId} and user ${userId}`, error);
        return null;
      }
      
      logger.info(`Tracked quiz delivery: poll ${pollId} to user ${userId}`);
      return data ? fromQuizDeliveryDbModel(data as QuizDeliveryDBModel) : null;
    } catch (error) {
      this.logSupabaseError(`trackQuizDelivery for poll ${pollId} and user ${userId}`, error);
      return null;
    }
  }
  
  /**
   * Mark a quiz as answered
   * @param userId User ID who answered
   * @param pollId Poll ID that was answered
   * @param isCorrect Whether the answer was correct
   * @returns The updated delivery record
   */
  async markQuizAsAnswered(userId: number, pollId: string, isCorrect: boolean): Promise<QuizDeliveryData | null> {
    try {
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('quiz_deliveries')
        .update({
          answered: true,
          answered_at: new Date().toISOString(),
          answer_correct: isCorrect
        })
        .match({ poll_id: pollId, user_id: userId })
        .select()
        .single();
      
      if (error) {
        this.logSupabaseError(`markQuizAsAnswered for poll ${pollId} and user ${userId}`, error);
        return null;
      }
      
      logger.info(`Marked quiz ${pollId} as answered by user ${userId}, correct: ${isCorrect}`);
      return data ? fromQuizDeliveryDbModel(data as QuizDeliveryDBModel) : null;
    } catch (error) {
      this.logSupabaseError(`markQuizAsAnswered for poll ${pollId} and user ${userId}`, error);
      return null;
    }
  }
  
  /**
   * Get a quiz delivery by poll ID and user ID
   * @param pollId The poll ID
   * @param userId The user ID
   * @returns The delivery record or null if not found
   */
  async getQuizDelivery(pollId: string, userId: number): Promise<QuizDeliveryData | null> {
    try {
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('quiz_deliveries')
        .select()
        .match({ poll_id: pollId, user_id: userId })
        .single();
      
      if (error) {
        this.logSupabaseError(`getQuizDelivery for poll ${pollId} and user ${userId}`, error);
        return null;
      }
      
      return data ? fromQuizDeliveryDbModel(data as QuizDeliveryDBModel) : null;
    } catch (error) {
      this.logSupabaseError(`getQuizDelivery for poll ${pollId} and user ${userId}`, error);
      return null;
    }
  }
  
  /**
   * Get all unanswered quizzes for a user
   * @param userId The user ID
   * @returns Array of unanswered quiz deliveries
   */
  async getUnansweredQuizzesForUser(userId: number): Promise<QuizDeliveryData[]> {
    try {
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('quiz_deliveries')
        .select()
        .match({ user_id: userId, answered: false });
      
      if (error) {
        this.logSupabaseError(`getUnansweredQuizzesForUser for user ${userId}`, error);
        return [];
      }
      
      return data ? data.map(item => fromQuizDeliveryDbModel(item as QuizDeliveryDBModel)) : [];
    } catch (error) {
      this.logSupabaseError(`getUnansweredQuizzesForUser for user ${userId}`, error);
      return [];
    }
  }
  
  /**
   * Get all unanswered quizzes within a time range
   * @param minMinutes Minimum minutes since quiz was sent
   * @param maxHours Maximum hours since quiz was sent
   * @returns Array of unanswered quiz deliveries with quiz info
   */
  async getUnansweredQuizzes(minMinutes: number = 30, maxHours: number = 24): Promise<Array<{
    pollId: string;
    question: string;
    theme: string;
    userId: number;
    createdAt: string;
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
        .lt('created_at', minTime.toISOString());  // At least minMinutes old
      
      if (quizError || !quizData || quizData.length === 0) {
        if (quizError) {
          this.logSupabaseError('getUnansweredQuizzes - quiz fetch', quizError);
        }
        return [];
      }
      
      // Get quiz deliveries to find out which users received these quizzes
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('quiz_deliveries')
        .select('poll_id, user_id, answered')
        .in('poll_id', quizData.map(q => q.poll_id))
        .eq('answered', false);
      
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
          createdAt: quizInfo?.created_at || new Date().toISOString()
        };
      }) || [];
      
      logger.info(`Found ${unansweredQuizzes.length} unanswered quizzes to remind users about`);
      return unansweredQuizzes;
    } catch (error) {
      this.logSupabaseError('getUnansweredQuizzes', error);
      return [];
    }
  }
}

// Export a singleton instance
export const quizDeliveryRepository = new QuizDeliveryRepository(); 
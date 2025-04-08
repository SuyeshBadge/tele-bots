/**
 * Quiz Types
 * 
 * TypeScript interfaces for quiz-related data structures
 */

/**
 * Quiz delivery data structure
 */
export interface QuizDeliveryData {
  id?: number;
  pollId: string;
  userId: number;
  deliveredAt: string;
  answered: boolean;
  answeredAt?: string;
  answerCorrect?: boolean;
}

/**
 * Supabase DB model for quiz delivery
 */
export interface QuizDeliveryDBModel {
  id?: number;
  poll_id: string;
  user_id: number;
  delivered_at: string;
  answered: boolean;
  answered_at?: string;
  answer_correct?: boolean;
}

/**
 * Map from DB model to app model
 */
export function fromQuizDeliveryDbModel(dbModel: QuizDeliveryDBModel): QuizDeliveryData {
  return {
    id: dbModel.id,
    pollId: dbModel.poll_id,
    userId: dbModel.user_id,
    deliveredAt: dbModel.delivered_at,
    answered: dbModel.answered,
    answeredAt: dbModel.answered_at,
    answerCorrect: dbModel.answer_correct
  };
}

/**
 * Map from app model to DB model
 */
export function toQuizDeliveryDbModel(appModel: QuizDeliveryData): QuizDeliveryDBModel {
  return {
    id: appModel.id,
    poll_id: appModel.pollId,
    user_id: appModel.userId,
    delivered_at: appModel.deliveredAt,
    answered: appModel.answered,
    answered_at: appModel.answeredAt,
    answer_correct: appModel.answerCorrect
  };
} 
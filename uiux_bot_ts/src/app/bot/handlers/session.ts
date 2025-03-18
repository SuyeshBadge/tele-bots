import { BotContext, QuizData } from './types';
import { quizRepository, QuizData as PersistentQuizData } from '../../utils/quiz-repository';
import { getChildLogger } from '../../utils/logger';
import { incrementQuizCount } from '../../utils/persistence';

const logger = getChildLogger('session');

// Direct database access version of activeQuizzes
export const activeQuizzes = {
  set: async (pollId: string, quizData: QuizData): Promise<void> => {
    // Create expiration date (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    // Create persistent quiz data
    const persistentQuiz: PersistentQuizData = {
      pollId,
      lessonId: quizData.lessonId,
      quizId: quizData.quizId,
      correctOption: quizData.correctOption,
      question: quizData.question,
      options: quizData.options,
      theme: quizData.theme,
      explanation: quizData.explanation,
      option_explanations: quizData.option_explanations,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    };
    
    // Save directly to the database
    await quizRepository.saveQuiz(persistentQuiz);
    logger.info(`Saved quiz data for poll ${pollId} to database`);
  },
  
  get: async (pollId: string): Promise<QuizData | undefined> => {
    try {
      // Get directly from the database
      const persistentQuiz = await quizRepository.getQuizByPollId(pollId);
      
      if (!persistentQuiz) {
        return undefined;
      }
      
      // Convert to QuizData format
      const quizData: QuizData = {
        correctOption: persistentQuiz.correctOption,
        question: persistentQuiz.question,
        options: persistentQuiz.options,
        theme: persistentQuiz.theme,
        explanation: persistentQuiz.explanation,
        option_explanations: persistentQuiz.option_explanations,
        lessonId: persistentQuiz.lessonId,
        quizId: persistentQuiz.quizId
      };
      
      return quizData;
    } catch (error) {
      logger.error(`Error getting quiz data for poll ${pollId}: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  },
  
  delete: async (pollId: string): Promise<void> => {
    // Delete directly from the database
    await quizRepository.deleteQuiz(pollId);
    logger.info(`Deleted quiz data for poll ${pollId} from database`);
  },
  
  has: async (pollId: string): Promise<boolean> => {
    // Check directly from the database
    const quiz = await quizRepository.getQuizByPollId(pollId);
    return !!quiz;
  }
};

// Define a mock progressRepository for compatibility
export const progressRepository = {
  saveQuizResult: async (userId: number, data: { isCorrect: boolean, lessonId: string, quizId: string, timestamp: string }) => {
    // Update the quiz count for the user and record the result
    incrementQuizCount(userId);
    return true;
  }
}; 
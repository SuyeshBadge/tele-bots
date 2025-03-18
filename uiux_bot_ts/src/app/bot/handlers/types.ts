import { Context, SessionFlavor } from 'grammy';
import { QuizData as PersistentQuizData } from '../../utils/quiz-repository';
import { LessonData } from '../../utils/lesson-types';

// Define session data structure
export interface SessionData {
  lastLessonTime?: Date;
  dailyLessonCount: number;
  lastTheme?: string;
  waitingForQuizAnswer?: boolean;
  quizCorrectAnswer?: number;
  quizOptions?: string[];
}

// Define bot context with session
export type BotContext = Context & SessionFlavor<SessionData>;

// Update the QuizData interface to extend PersistentQuizData
export interface QuizData extends Omit<PersistentQuizData, 'pollId' | 'createdAt' | 'expiresAt'> {
  correctOption: number;
  explanation?: string;
  theme?: string;
  question: string;
  options: string[];
  option_explanations?: string[]; 
  lessonId: string;
  quizId: string;
} 
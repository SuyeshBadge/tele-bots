/**
 * Lesson-related type definitions
 */

// Define raw lesson data from OpenAI
export interface OpenAILessonData {
  theme: string;
  title: string;
  content_points: string[];
  example_link?: {
    url: string;
    description: string;
  };
  vocabulary_terms?: Array<{
    term: string;
    definition: string;
    example: string;
  }>;
  quiz_question: string;
  quiz_options: string[];
  correct_option_index: number;
  explanation: string;
  option_explanations?: string[];
  video_query?: string;
}

// Define lesson data structure for database
export interface LessonData {
  id: string;
  title: string;
  theme: string;
  content: string;
  vocabulary: string;
  hasVocabulary: boolean;
  createdAt: string;
  quizQuestion?: string;
  quizOptions?: string[];
  quizCorrectIndex?: number;
  explanation?: string;
  optionExplanations?: string[];
  imageUrl?: string;
  example_link?: {
    url: string;
    description: string;
  };
  videoQuery?: string[];
} 
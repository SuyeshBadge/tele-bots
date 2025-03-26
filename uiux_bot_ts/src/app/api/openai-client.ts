/**
 * OpenAI API client for generating UI/UX lesson content.
 */

import { OpenAI } from 'openai';
import { getChildLogger } from '../utils/logger';
import { settings, UI_UX_THEMES } from '../config/settings';
import fs from 'fs';
import path from 'path';

// Configure logger
const logger = getChildLogger('openai');

// Configure OpenAI logger for detailed logging
const openaiLogger = getChildLogger('openai_responses');

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: settings.OPENAI_API_KEY,
  timeout: settings.REQUEST_TIMEOUT * 1000,
});

// Simple in-memory cache for lesson content
// Structure: {theme: {timestamp: number, content: LessonData}}
interface LessonCache {
  [theme: string]: {
    timestamp: number;
    content: LessonData;
  };
}

const _lessonCache: LessonCache = {};
const _cacheTtl = 3600 * 24; // Cache for 24 hours

// Cache for quiz data based on lesson content
interface QuizCache {
  [theme: string]: {
    timestamp: number;
    content: QuizData;
  };
}

const _quizCache: QuizCache = {};

// Cache for explanation responses
interface ExplanationCache {
  [key: string]: {
    timestamp: number;
    content: string;
  };
}

const _explanationCache: ExplanationCache = {};
const _explanationCacheTtl = 3600 * 24; // Cache for 24 hours

/**
 * Interface for lesson data
 */
interface LessonData {
  title: string;
  theme: string;
  content_points: string[];  // Array of bullet points
  quiz_question: string;
  quiz_options: string[];
  correct_option_index: number;
  explanation: string;
  option_explanations?: string[];
  vocabulary_terms?: {term: string, definition: string, example: string}[]; // Array of vocabulary terms with definitions and examples
  example_link?: {url: string, description: string}; // Link to a real-world example implementation
  video_query?: string; // Search query for YouTube
}

/**
 * Interface for quiz data
 */
interface QuizData {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;          // General explanation for the correct answer
  option_explanations?: string[]; // Specific explanations for each option
}

/**
 * Generate lesson content using OpenAI API with caching
 * 
 * @param themesToAvoid - Array of themes to avoid generating
 * @returns The generated lesson data
 */
async function generateLessonContent(themesToAvoid: string[] = [], quizzesToAvoid: string[] = []): Promise<LessonData> {
  let retryCount = 0;
  const maxRetries = 2; // Reduced from 3 to 2
  
  while (retryCount < maxRetries) {
    let theme = '';
    try {
      // Generate the prompt for the API call - streamlined for better content
      const themesToAvoidList = themesToAvoid.filter(Boolean).map(t => `- ${t}`).join('\n');
      const quizzesToAvoidList = quizzesToAvoid.filter(Boolean).map(q => `- ${q}`).join('\n');
      
      const prompt = `You are tasked with creating an engaging, beginner-friendly lesson following a structured, concise format. Carefully consider the following guidelines:
      
      1️⃣ Title:
      - Craft a concise, captivating title (max 10 words).
      
      2️⃣ Theme:
      - Specify the UI/UX lesson theme clearly (max 10 words).
      - I already know these topics so no need to repeat them:
      ${themesToAvoidList}
      
      3️⃣ Key Learning Points (5-7 total):
      - Begin each point with a unique, topic-relevant emoji (🎨 for colors, 🖱️ for interaction, 📱 for mobile, etc.).
      - Points should be clear, concise, beginner-friendly (max 20 words each).
      - Include one engaging, design-related fun fact.
      - Avoid repetition of emojis or sentence structure.
      
      4️⃣ Real-World Example:
      - Provide a valid URL (excluding apple.com) demonstrating the lesson’s concept effectively.
      - Clearly and concisely explain its relevance to the topic (max 20 words).
      
      5️⃣ Vocabulary Terms (3-5 total):
      - Include essential beginner terms clearly defined (max 15 words each).
      - Provide concise, relatable real-world examples (max 15 words each).
      
      6️⃣ Quiz Question:
      - Develop one beginner-level, multiple-choice question relevant to the lesson.
      - Provide exactly 4 plausible options, clearly incorrect yet relevant.
      - I already know these quiz topics so no need to repeat them:
      ${quizzesToAvoidList}
      
      7️⃣ Answer Explanations:
      - Clearly justify the correct answer, focusing on clarity and beginner-friendliness (max 40 words).
      - Provide concise, simple explanations why each incorrect option is incorrect (max 30 words each).
      
      8️⃣ Video Topic:
      - Suggest a highly focused YouTube search query (3-6 words) directly relevant to the lesson.
      - I already know these video topics so no need to repeat them:
      ${themesToAvoidList}
      
      🚀 Response Format (Always Provide Valid JSON):
      {
        "theme": "string (max 10 words)",
        "title": "string (max 10 words)",
        "content_points": ["string (unique emoji, max 20 words each)"],
        "example_link": {
          "url": "valid URL (excluding apple.com)",
          "description": "string (max 20 words)"
        },
        "vocabulary_terms": [
          {"term": "string", "definition": "string (max 15 words)", "example": "string (max 15 words)"}
        ],
        "quiz_question": "string (clear, beginner-friendly)",
        "correct_option_index": integer (0-3),
        "explanation": "string (max 40 words, explaining the correct answer)",
        "quiz_options": ["string (plausible but incorrect or correct)"],
        "option_explanations": ["string (max 30 words each)"],
        "video_query": "string (3-6 words, highly specific)"
      }
      
      ⚠️ Critical Guidelines:
      - Provide strictly valid JSON responses.
      - Maintain a friendly, clear, engaging tone suitable for absolute beginners.
      - Adhere strictly to all provided word limits.
      - Avoid duplication of emojis or language structures.
      - Ensure clarity and practical applicability of all provided examples.`;
      

      // Make the API call with better prompt focused on emojis
      logger.info(`Sending OpenAI request for lesson with model: ${settings.OPENAI_MODEL}`);
      
      // Record the prompt for logging
      // Define the system message for AI behavior
      const systemMessage = 
      "You are an expert UI/UX educator, focused on crafting beginner-friendly lessons that are visually engaging, structured, and easy to follow. " +
      "Your content must be clear, concise, and designed to maximize learner comprehension and interest. " +
      "\n\n🔑 *Formatting Rules:* " +
      "\n- Every key learning point MUST start with a unique, topic-relevant emoji (e.g., 🎨 for color, 🖱️ for interaction, 📱 for mobile design, etc.). " +
      "\n- NEVER use generic bullet points—always use meaningful emojis that reflect the specific subject. " +
      "\n\n📚 *Content Requirements:* " +
      "\n- Define key vocabulary terms clearly and concisely. " +
      "\n- Provide practical, relatable examples that show how these terms apply to real-world design scenarios. " +
      "\n- Keep explanations beginner-friendly, avoiding jargon unless it’s defined. " +
      "\n\n🌐 *Examples:* " +
      "\n- Always include a link to a real, accessible webpage that demonstrates the concept in action. " +
      "\n- Use well-known, reputable sites to highlight best practices. " +
      "\n- STRICTLY DO NOT use apple.com as an example. " +
      "\n\n✅ *Tone & Style:* " +
      "\n- Make the tone friendly, motivating, and easy to digest. " +
      "\n- Ensure formatting supports readability and engagement. " +
      "\n- Follow all response format guidelines precisely.";
    
      
   
      
      // logger.info(`LESSON SYSTEM PROMPT: ${systemMessage}`);
      // logger.info(`LESSON USER PROMPT: ${prompt}`);
      
      const response = await openai.chat.completions.create({
        model: settings.OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content: systemMessage
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.5, // Reduced from 0.7 to 0.5 for more consistency
        max_tokens: 1000, // Increased from 800 to accommodate explanations for all options
      });
      
      // Extract and parse the content
      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No content returned from OpenAI');
      }
      
      // Enhanced logging
      const finishReason = response.choices[0].finish_reason;
      const promptTokens = response.usage?.prompt_tokens;
      const completionTokens = response.usage?.completion_tokens;
      const totalTokens = response.usage?.total_tokens;
      
      logger.info(`OpenAI response received - Finish reason: ${finishReason}, Tokens: ${completionTokens}/${promptTokens}/${totalTokens}`);
      
      // Log request details and response to the specialized OpenAI logger
      openaiLogger.info(`LESSON REQUEST - Model: ${settings.OPENAI_MODEL}, Tokens: ${totalTokens}`);
      openaiLogger.info(`LESSON RESPONSE - Raw`, { response: content });
      logger.debug(`LESSON RESPONSE - Raw: ${content}`);
      
      let cleanedContent = content.trim();
      
      // Clean markdown formatting
      if (cleanedContent.includes("```")) {
        cleanedContent = cleanedContent.replace(/```(?:json)?/g, '').trim();
      }
      
      // Try direct JSON parsing
      try {
        const lessonData = JSON.parse(cleanedContent) as LessonData;
        theme = lessonData.theme;
        // Validate required fields
        const requiredFields = ['title', 'theme', 'content_points', 'quiz_question', 'quiz_options', 'correct_option_index', 'explanation'];
        for (const field of requiredFields) {
          if (!(field in lessonData)) {
            throw new Error(`Missing required field in lesson data: ${field}`);
          }
        }
        
        // Validate quiz options
        if (!Array.isArray(lessonData.quiz_options) || lessonData.quiz_options.length < 2) {
          throw new Error('Quiz options must be an array with at least 2 items');
        }
        
        // Validate correct option index
        if (
          typeof lessonData.correct_option_index !== 'number' || 
          lessonData.correct_option_index < 0 || 
          lessonData.correct_option_index >= lessonData.quiz_options.length
        ) {
          throw new Error(`Invalid correct_option_index: ${lessonData.correct_option_index}`);
        }
        
        // Validate vocabulary terms if they exist
        if (lessonData.vocabulary_terms) {
          if (!Array.isArray(lessonData.vocabulary_terms)) {
            lessonData.vocabulary_terms = []; // Reset to empty array if invalid
          } else {
            // Make sure each vocabulary term has both term and definition
            lessonData.vocabulary_terms = lessonData.vocabulary_terms
              .filter(item => typeof item === 'object' && item !== null && 'term' in item && 'definition' in item && 'example' in item);
          }
        } else {
          // If vocabulary terms are missing, provide an empty array
          lessonData.vocabulary_terms = [];
        }

        // Validate theme
        if (!lessonData.theme) {
          throw new Error('Theme is required');
        }
        const themeLower = theme.toLowerCase().trim();
        
        
        // Add to cache
        _lessonCache[themeLower] = {
          timestamp: Date.now(),
          content: lessonData
        };
        
        return lessonData;
      } catch (parseError) {
        logger.error(`Error parsing JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        logger.error(`Raw content: ${cleanedContent}`);
        
        // Try again with a different approach or fail
        retryCount++;
        if (retryCount >= maxRetries) {
          logger.warn(`Maximum retries reached, using fallback lesson for theme: ${theme}`);
          throw new Error(`Failed to generate lesson: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      logger.error(`Error generating lesson content: ${error instanceof Error ? error.message : String(error)}`);
      
      retryCount++;
      if (retryCount >= maxRetries) {
        logger.warn(`Maximum retries reached, using fallback lesson for theme: ${theme}`);
        throw new Error(`Failed to generate lesson: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error(`Failed to generate lesson`);
}

/**
 * Generate a lesson for a UI/UX theme
 * 
 * @param themesToAvoid - Array of themes to avoid generating
 * @returns Lesson content separated by sections
 */
export interface LessonSections {
  title: string;
  theme: string;
  contentPoints: string[];
  quizQuestion: string;
  quizOptions: string[];
  correctOptionIndex: number;
  explanation: string;
  optionExplanations: string[];
  vocabulary: {term: string, definition: string, example: string}[];
  videoQuery?: string;
  example_link?: {url: string, description: string};
}

export async function generateLesson(themesToAvoid: string[] = [], quizzesToAvoid: string[] = []): Promise<LessonSections> {
  try {
    // Generate lesson content using OpenAI
    const lessonData = await generateLessonContent(themesToAvoid, quizzesToAvoid);

    // Log only the theme and title, not the entire lesson data
    logger.info(`Generated lesson: ${lessonData.title} (${lessonData.theme})`);
    
    // Also cache this as a quiz since it contains quiz data
    _quizCache[lessonData.theme.toLowerCase().trim()] = {
      timestamp: Date.now(),
      content: {
        question: lessonData.quiz_question,
        options: lessonData.quiz_options,
        correctIndex: lessonData.correct_option_index,
        explanation: lessonData.explanation,
        option_explanations: lessonData.option_explanations || generateDefaultExplanations(lessonData.quiz_options, lessonData.correct_option_index, lessonData.theme)
      }
    };
    
    // Return the sections in the correct format
    return {
      title: lessonData.title,
      theme: lessonData.theme,
      contentPoints: lessonData.content_points,
      quizQuestion: lessonData.quiz_question,
      quizOptions: lessonData.quiz_options,
      correctOptionIndex: lessonData.correct_option_index,
      explanation: lessonData.explanation,
      optionExplanations: lessonData.option_explanations || [],
      vocabulary: lessonData.vocabulary_terms || [],
      videoQuery: lessonData.video_query,
      example_link: lessonData.example_link
    };
  } catch (error) {
    logger.error(`Error generating lesson: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to generate lesson: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate a quiz for a UI/UX theme
 * 
 * @param theme - Optional theme for the quiz
 * @returns Quiz data with question, options, and correct answer
 */
export async function generateQuiz(theme?: string): Promise<QuizData> {
  const quizTheme = theme || getRandomTheme();
  const themeLower = quizTheme.toLowerCase().trim();
  
  try {
    // Check if we have a cached quiz from a recently generated lesson
    if (themeLower in _quizCache) {
      const { timestamp, content } = _quizCache[themeLower];
      if (Date.now() - timestamp < _cacheTtl * 1000) {
        logger.info(`Using cached quiz for theme: ${quizTheme}`);
        return content;
      }
    }
    
    // If no cached quiz, generate lesson content which includes quiz data
    const lessonData = await generateLessonContent();
    
    return {
      question: lessonData.quiz_question,
      options: lessonData.quiz_options,
      correctIndex: lessonData.correct_option_index,
      explanation: lessonData.explanation,
      option_explanations: lessonData.option_explanations || 
        generateDefaultExplanations(lessonData.quiz_options, lessonData.correct_option_index, quizTheme)
    };
  } catch (error) {
    logger.error(`Error generating quiz: ${error instanceof Error ? error.message : String(error)}`);
    
    // Fallback quiz
    const fallbackOptions = [
      "Making designs as complex as possible",
      "Using user feedback to improve designs",
      "Ignoring accessibility concerns",
      "Following the latest design trends"
    ];
    const fallbackCorrectIndex = 1;
    const fallbackExplanation = `Using user feedback is essential when implementing any UI/UX design principle related to ${quizTheme}.`;
    
    return {
      question: `What is a key principle of good UI/UX design related to ${quizTheme}?`,
      options: fallbackOptions,
      correctIndex: fallbackCorrectIndex,
      explanation: fallbackExplanation,
      option_explanations: generateDefaultExplanations(fallbackOptions, fallbackCorrectIndex, quizTheme)
    };
  }
}

/**
 * Generate default explanations for quiz options when none are provided
 * @param options Quiz options
 * @param correctIndex Index of correct option
 * @param theme Theme of the quiz
 * @returns Array of explanations for each option
 */
function generateDefaultExplanations(options: string[], correctIndex: number, theme: string): string[] {
  return options.map((option, index) => {
    if (index === correctIndex) {
      return `✅ Correct! "${option}" is the right choice for ${theme}. This approach aligns with best practices in UI/UX design.`;
    } else {
      return `❌ "${option}" isn't optimal for ${theme}. Consider the correct answer which offers a more effective approach.`;
    }
  });
}

/**
 * Get a random UI/UX theme
 * 
 * @returns A random UI/UX theme from the predefined list
 */
export function getRandomTheme(): string {
  const randomIndex = Math.floor(Math.random() * UI_UX_THEMES.length);
  return UI_UX_THEMES[randomIndex];
}

export default {
  generateLesson,
  generateQuiz,
  getRandomTheme,
}; 
/**
 * Claude API client for generating UI/UX lesson content.
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { getChildLogger } from '../utils/logger';
import { settings, UI_UX_THEMES } from '../config/settings';
import fs from 'fs';
import path from 'path';
import { jsonrepair } from 'jsonrepair';
import { lessonRepository } from '../utils/lesson-repository';

// Configure logger
const logger = getChildLogger('claude');

// Configure Claude logger for detailed logging
const claudeLogger = getChildLogger('claude_responses');

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize Claude client
const claude = new Anthropic({
  apiKey: settings.CLAUDE_API_KEY,
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
  [key: string]: {
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

// Configuration values
const maxRetries = 1; // Reduce retries to minimize costs

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
  vocabulary_terms?: {term: string, definition: string, example: string}[];
  example_link?: {url: string, description: string};
  video_query?: string[];
}

/**
 * Interface for quiz data
 */
interface QuizData {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  option_explanations?: string[];
}

/**
 * Validate and fix the lesson data against the expected schema
 */
function validateAndFixLessonData(data: any): LessonData {
  // Create a base object with default values for all required fields
  const validated: LessonData = {
    theme: data.theme || "UI/UX Design Principles",
    title: data.title || "Understanding UI/UX Design",
    content_points: Array.isArray(data.content_points) ? data.content_points : [],
    quiz_question: data.quiz_question || "What is a key principle of UI/UX design?",
    quiz_options: Array.isArray(data.quiz_options) ? data.quiz_options : [
      "Visual aesthetics only",
      "User-centered design",
      "Complex interfaces",
      "Technical implementation"
    ],
    correct_option_index: typeof data.correct_option_index === 'number' ? data.correct_option_index : 1,
    explanation: data.explanation || "User-centered design is the core principle of effective UI/UX design.",
    option_explanations: Array.isArray(data.option_explanations) ? data.option_explanations : [],
    vocabulary_terms: Array.isArray(data.vocabulary_terms) ? data.vocabulary_terms : [],
    example_link: data.example_link || undefined,
    video_query: Array.isArray(data.video_query) ? data.video_query : ["UI UX design principles"]
  };
  
  // Ensure content_points has at least some content
  if (validated.content_points.length < 3) {
    validated.content_points = [
      "🎨 Good UI/UX design focuses on user needs and expectations",
      "🔄 Iterative testing helps identify and fix usability issues",
      "📱 Responsive design ensures consistent experience across devices",
      "🔍 User research provides valuable insights for design decisions"
    ];
  }
  
  // Ensure the correct option index is valid
  if (validated.correct_option_index >= validated.quiz_options.length) {
    validated.correct_option_index = 0;
  }
  
  // Ensure vocabulary_terms is properly initialized and has at least one item
  if (!validated.vocabulary_terms || validated.vocabulary_terms.length === 0) {
    validated.vocabulary_terms = [
      {
        term: "User-Centered Design",
        definition: "A design approach that prioritizes user needs throughout the process",
        example: "Conducting user interviews before creating wireframes"
      }
    ];
  }
  
  return validated;
}

/**
 * Extract JSON from Claude's response
 */
function extractJsonFromResponse(content: string): string {
  let processed = content.trim();
  
  // Remove markdown code blocks if present
  if (processed.includes("```")) {
    processed = processed.replace(/```(?:json)?([\s\S]*?)```/g, '$1').trim();
  }
  
  // Extract JSON object using regular expression
  const jsonMatch = processed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  
  // If no match found, return the original content for repair
  return processed;
}

/**
 * Generate lesson content using Claude API with caching
 * 
 * @param themesToAvoid - Array of themes to avoid generating
 * @returns The generated lesson data
 */
async function generateLessonContent(themesToAvoid: string[] = [], quizzesToAvoid: string[] = []): Promise<LessonData> {
  let retryCount = 0;
  logger.info(`Generating lesson content with Claude API`);
  
  while (retryCount < maxRetries) {
    let theme = '';
    try {
      // Generate the prompt for the API call - streamlined for better content
      const themesToAvoidList = themesToAvoid.filter(Boolean).map(t => ` ${t}`).join(',');
      const quizzesToAvoidList = quizzesToAvoid.filter(Boolean).map(q => ` ${q}`).join(',');
      
      const prompt = `
      🧠 ROLE & GOAL:
      You are an expert UI/UX educator and curriculum designer. Your task is to generate a unique, structured, engaging, and intermediate-level UI/UX lesson in **strictly valid JSON format**, optimized for clarity, learning value, and creativity.
      
      Your output must follow this exact structure, obey **all word/format constraints**, and most importantly: **MUST NOT DUPLICATE themes, topics, or quiz content already provided in the exclusions list**.
      
      ---
      🔒 AVOID THESE:
      You must strictly avoid repeated content across:
      1. Lesson Topics: {{ ${themesToAvoidList} }}
      2. Quizzes: {{ ${quizzesToAvoidList} }}
      3. Video Topics: {{ ${themesToAvoidList} }}
      
      💡 Use logic to **check for overlap or semantic similarity** to avoid duplication. Do not repackage excluded themes with synonyms or surface-level variation.
      
      ---
      📦 STRUCTURE + FORMAT (ALWAYS return valid JSON):
      
      {
        "theme": "string (max 10 words, completely new from exclusion list)",
        "title": "string (max 10 words, unique & catchy)",
        "content_points": [
          "🧠 Unique emoji + key idea (max 20 words)",
          ...
          // 5-7 items total
        ],
        "example_link": {
          "url": "valid URL (not apple.com)",
          "description": "real-world connection (max 20 words)"
        },
        "vocabulary_terms": [
          {
            "term": "string",
            "definition": "clear, short definition (max 15 words)",
            "example": "realistic UX/UI example (max 15 words)"
          },
          ...
          // 3–5 items
        ],
        "quiz_question": "1 intermediate-level multiple choice question (not from exclusion list)",
        "quiz_options": ["Option A", "Option B", "Option C", "Option D"],
        "correct_option_index": integer (0-3),
        "explanation": "Concise reason for correct answer (max 40 words)",
        "option_explanations": [
          "Why Option A is incorrect (max 30 words)",
          ...
          // All incorrect options
        ],
        "video_query": ["highly focused YouTube query (3-6 words)", ...]
      }
      
      ---
      📌 STYLE & QUALITY RULES:
      
      ✅ Logic & Deduplication:
      - Before generating content, scan exclusion lists and **verify uniqueness** across all fields.
      - Do not paraphrase existing topics from exclusion list — think fresh.
      
      ✅ Language & Voice:
      - Friendly, confident, helpful tone.
      - No redundant phrases or emoji reuse.
      - Sentence structures must vary naturally.
      
      ✅ Content:
      - Prioritize **practical application** and real-world design thinking.
      - Fun fact must be **relevant, surprising, and design-specific**.
      - Vocabulary and quiz must be **original**, not reworded from exclusions.
      
      ✅ Emoji Rules:
      - Each content point uses a distinct emoji.
      - Emojis must relate directly to the point's concept (e.g. 🎯 for focus, 📱 for mobile).
      
      ---
      🛑 NON-NEGOTIABLES:
      - Output must be valid JSON.
      - Must follow all word limits.
      - Must avoid all forms of duplication.
      - Must prioritize logic-driven filtering.
      
      ---
      🎯 PURPOSE:
      The lesson should be unique, useful to intermediate learners, and capable of fitting into a wider, non-repetitive curriculum.
      
      ---
      ⚠️ CRITICAL JSON FORMATTING RULES:
      - Ensure all JSON syntax is valid with proper commas, brackets, and quotes.
      - Do not include any text outside the JSON object.
      - Do not use single quotes for strings, always use double quotes.
      - Ensure all property names are in double quotes.
      - Make sure all arrays and objects are properly closed.
      - Do not include trailing commas in arrays or objects.
      - Escape any double quotes within string values with backslashes.
      `;
      

      // Update the system message with instructions for explanation formatting
      const systemMessage = 
      `🎓 ROLE DEFINITION:
      You are a seasoned UI/UX educator and content designer. Your job is to create **well-structured, engaging, and intermediate-level educational content** that is visually digestible and enhances learner comprehension with clarity and purpose.
      
      Your responses **must follow all logic rules, format constraints, and tone requirements strictly.**
      
      ---
      📐 STRUCTURE & FORMATTING RULES:
      
      - Output must be a valid JSON object with these exact fields with proper markdown formatting:
      
      
      - Each content point must:
        - Start with a unique, relevant emoji
        - Be under 100 characters
        - Use clear, concise language
        - Follow proper grammar and punctuation
      
      - Quiz questions must:
        - Be clearly written and unambiguous
        - Use proper HTML escaping
        - Focus on practical UI/UX knowledge
        - Be of intermediate difficulty level
      
      - Quiz options must:
        - Be concise and specific
        - Have one clearly correct answer
        - Include plausible but incorrect alternatives
        - Be free of obvious hints to the correct answer
      
      - Quiz explanations must:
        - Begin with a clear statement of why the answer is correct
        - Avoid starting with phrases like "Correct!" that might confuse users
        - Provide educational context that expands understanding
        - Be factually accurate and specific to the UI/UX field
      
      - All text fields must:
        - Use proper HTML escaping
        - Avoid markdown formatting
        - Be properly sanitized for Telegram
      
      - JSON must be:
        - Properly formatted with double quotes
        - Free of trailing commas
        - Include all required fields
        - Have valid data types
      
      
      1️⃣ KEY LEARNING POINTS:
      - Begin **EACH and EVERY** point with a unique, topic-relevant emoji (🎨 for colors, 🧭 for navigation, 🖱️ for interactions, etc.).
      - NEVER skip the emoji at the beginning of any content point - this is CRITICAL for formatting.
      - Use a completely different emoji for each point - no duplicate emojis.
      - Use visually distinctive emojis that stand out and relate to the content.
      - Keep each point **under 20 words**, and vary sentence structure for a natural flow.
      - Include **one relevant, engaging fun fact** related to the design topic.
      
      2️⃣ VOCABULARY TERMS:
      - Provide 3–5 terms per lesson.
      - Each term must include:
        - A short, jargon-free definition (**max 15 words**).
        - A **clear, real-world design example** (**max 15 words**).
      
      3️⃣ REAL-WORLD EXAMPLES:
      - Include one **valid, accessible URL** showing the concept in action.
      - Clearly explain its relevance (**max 20 words**).
      - ✅ Use only reputable websites.
      - ❌ Never use *apple.com*.
      
      4️⃣ QUIZ CREATION:
      - Write **one intermediate-level multiple-choice question**.
      - Include exactly **4 plausible options** (1 correct, 3 incorrect but relevant).
      - Make sure the quiz_question field has a complete, well-formed question.
      - Ensure each option in quiz_options array is a complete, standalone answer.
      - Provide:
        - A concise explanation of the correct answer (**max 40 words**) that does NOT begin with "Correct!" or "✅".
        - Individual feedback on incorrect options (**max 30 words each**).
        - Explanation that educates even if the user got the answer correct.
      
      5️⃣ VIDEO SUGGESTION:
      - Recommend a **focused YouTube search query** (3–6 words max) that supports the lesson.
      
      ---
      🧠 LOGIC & CONTENT GUIDELINES:
      
      - Always check: **Are any themes, terms, or quiz content overlapping with excluded lists?**
      - Do NOT reword or slightly modify previously used topics — every lesson must be **original in theme and content**.
      - Avoid repetition in structure, vocabulary, or phrasing between lessons.
      - Content should be **practical, specific, and reflect real-world UI/UX thinking**.
      
      ---
      🎨 TONE & STYLE:
      
      - Use a friendly, clear, confident tone.
      - Prioritize **engagement, clarity, and learner motivation**.
      - Maintain **clean structure** for readability — make it easy to follow and fun to read.
      - Avoid buzzwords unless defined; keep it **intermediate-level accessible**.
      
      ---
      ⚠️ CRITICAL:
      - Follow all format, logic, and tone requirements precisely.
      - Output MUST be usable, educational, and aligned with modern UI/UX best practices.
      - Respond in a way that feels **smart, fresh, and thoughtfully designed**.
      
      ---
      🔍 JSON FORMATTING REQUIREMENTS:
      - Your response MUST be valid JSON that can be parsed by a JSON parser.
      - IMPORTANT: Use only straight double quotes (") for all strings and property names, NEVER fancy quotes ("") or ('').
      - ALWAYS properly escape any quotation marks within content by using a backslash. Example: "Microsoft\\'s design toolkit" NOT "Microsoft's design toolkit".
      - Add a comma after EVERY array or object item EXCEPT the last one.
      - CRITICAL: Always put commas between array elements. Example: ["item1", "item2", "item3"]
      - For content_points array, ensure each element is properly separated by commas.
      - DO NOT add commas after the last item in arrays or objects.
      - Ensure all arrays and objects are properly closed with matching brackets.
      - Escape any double quotes within string values with backslashes.
      - Do not include any text outside the JSON object.
      - Do not use markdown code blocks or other formatting around the JSON.
      - EXAMPLE of correct content_points array with REQUIRED emojis:
        "content_points": [
          "🔍 First point always starts with emoji",
          "💡 Second point always starts with a different emoji",
          "🎨 Third point always starts with yet another unique emoji",
          "📱 Fourth point with different emoji",
          "🧠 Fifth point with different emoji"
        ]
      - EXAMPLE of correctly formatted explanation:
        "explanation": "User-centered design prioritizes solving user needs effectively through research and testing. This approach ensures products are intuitive and valuable."
      - EXAMPLE of correctly escaped quotes:
        "example": "The designer said, \\"This interface needs improvement\\"" 
      `;
      
      
      // logger.info(`LESSON SYSTEM PROMPT: ${systemMessage}`);
      // logger.info(`LESSON USER PROMPT: ${prompt}`);
      
      const response = await claude.messages.create({
        model: settings.CLAUDE_MODEL,
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        system: systemMessage,
        temperature: 0.5,
      });
      
      // Extract and parse the content
      const contentBlock = response.content[0];
      // Check if the content block has a text property
      if ('text' in contentBlock) {
        const content = contentBlock.text;
        if (!content) {
          throw new Error('No content returned from Claude');
        }
        
        // Enhanced logging
        const usage = response.usage;
        const promptTokens = usage?.input_tokens;
        const completionTokens = usage?.output_tokens;
        const totalTokens = usage?.input_tokens + usage?.output_tokens;
        
        logger.info(`Claude response received - Tokens: ${completionTokens}/${promptTokens}/${totalTokens}`);
        
        // Log request details and response to the specialized Claude logger
        claudeLogger.info(`LESSON REQUEST - Model: ${settings.CLAUDE_MODEL}, Tokens: ${totalTokens}`);
        claudeLogger.info(`LESSON RESPONSE - Raw`, { response: content });
        logger.debug(`LESSON RESPONSE - Raw: ${content}`);
        
        try {
          // Extract JSON from the response
          const extractedJson = extractJsonFromResponse(content);
          
          // Use jsonrepair to fix any JSON formatting issues
          const repairedJson = jsonrepair(extractedJson);
          
          // Parse the repaired JSON
          let parsedData = JSON.parse(repairedJson);
          
          // Handle both single lesson and batched lesson formats (for compatibility)
          let lessonData;
          if (parsedData.lessons && Array.isArray(parsedData.lessons) && parsedData.lessons.length > 0) {
            // If "lessons" array exists, take the first lesson
            lessonData = parsedData.lessons[0];
          } else {
            // Otherwise, assume it's a single lesson format
            lessonData = parsedData;
          }
          
          // Validate and fix the lesson data
          lessonData = validateAndFixLessonData(lessonData);
          
          theme = lessonData.theme;
          
          // Add to cache
          _lessonCache[theme.toLowerCase().trim()] = {
            timestamp: Date.now(),
            content: lessonData
          };
          
          return lessonData;
        } catch (parseError) {
          logger.error(`Error parsing JSON response with jsonrepair: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
          logger.error(`Raw content: ${content}`);
          
          // Try again with a different approach or fail
          retryCount++;
          if (retryCount >= maxRetries) {
            logger.warn(`Maximum retries reached, using fallback lesson for theme: ${theme}`);
            throw new Error(`Failed to generate lesson: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } else {
        // Handle case where content block is not text (e.g., tool use)
        logger.error('Received unexpected content type from Claude (not text)');
        logger.debug(`Content block type: ${contentBlock.type}`);
        
        // Try again with a different approach
        retryCount++;
        if (retryCount >= maxRetries) {
          logger.warn(`Maximum retries reached, using fallback lesson for theme: ${theme}`);
          throw new Error('Failed to generate lesson: Received non-text content from Claude');
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
  videoQuery?: string[];
  example_link?: {url: string, description: string};
}

export async function generateLesson(themesToAvoid: string[] = [], quizzesToAvoid: string[] = []): Promise<LessonSections> {
  try {
    // Generate lesson content using Claude
    const lessonData = await generateLessonContent(themesToAvoid, quizzesToAvoid);

    // Log only the theme and title, not the entire lesson data
    logger.info(`Generated lesson: ${lessonData.title} (${lessonData.theme})`);
    
    // Generate a unique cache key using both theme and a timestamp
    const cacheKey = `${lessonData.theme.toLowerCase().trim()}-${Date.now()}`;
    
    // Also cache this as a quiz since it contains quiz data
    _quizCache[cacheKey] = {
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
  getRandomTheme,
}; 
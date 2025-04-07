/**
 * Batch Processor for Claude API
 * 
 * Implements batch request processing for lesson generation using Anthropic's Message Batches API.
 * This allows generating multiple lessons in a single request, reducing costs and improving efficiency.
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { getChildLogger } from '../utils/logger';
import { settings, UI_UX_THEMES } from '../config/settings';
import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient } from '../../database/supabase-client';
import { LessonData } from '../utils/lesson-types';
import { lessonRepository } from '../utils/lesson-repository';
import { jsonrepair } from 'jsonrepair';
import { anthropicRateLimiter, batchApiRateLimiter, sleep } from '../utils/rate-limiter';

// Configure logger
const logger = getChildLogger('batch-processor');

// Configure Claude batch logger
const batchLogger = getChildLogger('claude_batch');

// Helper functions for processing Claude responses
/**
 * Extract JSON from Claude's text response
 */
function extractJsonFromResponse(text: string): string {
  // Look for JSON content in the response
  const jsonRegex = /\{[\s\S]*\}/g;
  const match = text.match(jsonRegex);
  
  if (match && match[0]) {
    return match[0];
  }
  
  // If no JSON found, return empty object
  return '{}';
}

/**
 * Validate and fix lesson data
 */
function validateAndFixLessonData(data: any): any {
  // Ensure all required fields exist
  const fixedData = {
    theme: data.theme || 'UI/UX Design',
    title: data.title || 'UI/UX Design Principles',
    content_points: Array.isArray(data.content_points) ? data.content_points : [
      '🔍 UI/UX design focuses on creating intuitive interfaces.',
      '🎨 Color theory is essential for effective visual design.',
      '📱 Responsive design ensures good experience on all devices.'
    ],
    example_link: data.example_link || {
      url: 'https://uxplanet.org/ui-ux-design-principles-389c1a9ac951',
      description: 'A comprehensive guide to UI/UX design principles'
    },
    vocabulary_terms: Array.isArray(data.vocabulary_terms) ? data.vocabulary_terms : [],
    quiz_question: data.quiz_question || 'What is the primary goal of UI/UX design?',
    quiz_options: Array.isArray(data.quiz_options) ? data.quiz_options : [
      'Make interfaces visually appealing',
      'Create intuitive user experiences',
      'Use the latest design trends',
      'Minimize development costs'
    ],
    correct_option_index: typeof data.correct_option_index === 'number' ? data.correct_option_index : 1,
    explanation: data.explanation || 'Creating intuitive user experiences is the primary goal of UI/UX design.',
    option_explanations: Array.isArray(data.option_explanations) ? data.option_explanations : [],
    video_query: Array.isArray(data.video_query) ? data.video_query : ['UI UX design basics']
  };
  
  return fixedData;
}

// Initialize Claude client with batch support
const claude = new Anthropic({
  apiKey: settings.CLAUDE_API_KEY,
  timeout: settings.REQUEST_TIMEOUT * 1000
});

// Pool types
export type PoolType = 'scheduled' | 'on-demand';

// Pool sizes and thresholds
const POOL_SIZES = {
  'scheduled': 20,
  'on-demand': 15
};

const POOL_MIN_THRESHOLDS = {
  'scheduled': 5,
  'on-demand': 3
};

/**
 * Get the system message for lesson generation
 */
function getSystemMessage(): string {
  return `🎓 ROLE DEFINITION:
  You are a seasoned UI/UX educator and content designer. Your job is to create **well-structured, engaging, and intermediate-level educational content** that is visually digestible and enhances learner comprehension with clarity and purpose.
  
  Your responses **must follow all logic rules, format constraints, and tone requirements strictly.**
  
  ---
  📐 STRUCTURE & FORMATTING RULES:
  
  - Output must be a valid JSON object with a "lessons" array containing EXACTLY 5 uniquely themed lessons
  - Each lesson must have these exact fields with proper markdown formatting:
  
  
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
  - ENSURE EACH LESSON IN THE ARRAY HAS A COMPLETELY UNIQUE THEME FROM THE OTHERS
  
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
  - GENERATE EXACTLY 5 UNIQUE LESSONS in your response, each with different themes
  
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
  - EXAMPLE of correct lesson array format:
    "lessons": [
      {
        "theme": "UI/UX Heuristics",
        "title": "Nielsen's Heuristic Principles",
        ...other properties...
      },
      {
        "theme": "Color Theory",
        "title": "Using Color Psychology in Design",
        ...other properties...
      },
      ...more unique lessons to make 5 total...
    ]`;
}

/**
 * Get the prompt for lesson generation with themes to avoid
 * @param themesToAvoid - Array of themes to avoid generating
 * @param quizzesToAvoid - Array of quizzes to avoid generating
 * @returns The formatted prompt for Claude
 */
function getLessonPrompt(themesToAvoid: string[] = [], quizzesToAvoid: string[] = []): string {
  const themesToAvoidList = themesToAvoid.filter(Boolean).map(t => ` ${t}`).join(',');
  const quizzesToAvoidList = quizzesToAvoid.filter(Boolean).map(q => ` ${q}`).join(',');
  
  return `
  🧠 ROLE & GOAL:
  You are an expert UI/UX educator and curriculum designer. Your task is to generate EXACTLY 5 unique, structured, engaging, and intermediate-level UI/UX lessons in **strictly valid JSON format**, optimized for clarity, learning value, and creativity.
  
  Your output must follow this exact structure, obey **all word/format constraints**, and most importantly: **MUST NOT DUPLICATE themes, topics, or quiz content already provided in the exclusions list or between the lessons you generate**.
  
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
    "lessons": [
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
        "video_query": ["highly focused YouTube search query (3-6 words)", ...]
      },
      // Generate EXACTLY 5 lessons total - each with unique themes and content
    ]
  }
  
  ---
  📌 STYLE & QUALITY RULES:
  
  ✅ Logic & Deduplication:
  - Before generating content, scan exclusion lists and **verify uniqueness** across all fields.
  - Do not paraphrase existing topics from exclusion list — think fresh.
  - ENSURE EACH LESSON HAS A COMPLETELY UNIQUE THEME FROM THE OTHERS YOU GENERATE
  
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
  - MUST GENERATE EXACTLY 5 UNIQUE LESSONS IN A SINGLE RESPONSE.
  
  ---
  🎯 PURPOSE:
  Each lesson should be unique, useful to intermediate learners, and capable of fitting into a wider, non-repetitive curriculum.
  
  ---
  ⚠️ CRITICAL JSON FORMATTING RULES:
  - Ensure all JSON syntax is valid with proper commas, brackets, and quotes.
  - Do not include any text outside the JSON object.
  - Do not use single quotes for strings, always use double quotes.
  - Ensure all property names are in double quotes.
  - Make sure all arrays and objects are properly closed.
  - Do not include trailing commas in arrays or objects.
  - Escape any double quotes within string values with backslashes.`;
}

/**
 * Create a batch ID for tracking batches
 */
function createBatchId(): string {
  return `batch-${Date.now()}-${uuidv4().substring(0, 8)}`;
}

/**
 * Process the results of a batch job
 * @param batchId - The ID of the batch
 * @param resultsUrl - URL to download batch results
 * @param poolType - Type of pool (scheduled or on-demand)
 */
export async function processBatchResults(batchId: string, resultsUrl: string, poolType: PoolType): Promise<void> {
  try {
    logger.info(`Processing batch results for batch ${batchId}`);
    
    // Update batch job status to processing
    await updateBatchJobStatus(batchId, 'processing');
    
    // Apply rate limiting before making the API call
    await batchApiRateLimiter.waitAndConsume(1);
    
    // Fetch the results from the URL with proper authentication
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('x-api-key', settings.CLAUDE_API_KEY || '');
    headers.append('anthropic-version', '2023-06-01');
    
    // Fetch with authentication headers
    const response = await fetch(resultsUrl, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch batch results: ${response.status} ${response.statusText}`);
    }
    
    // Parse the results
    const resultsText = await response.text();
    const resultsLines = resultsText.split('\n').filter(line => line.trim() !== '');
    
    logger.info(`Processing ${resultsLines.length} results from batch ${batchId}`);
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const line of resultsLines) {
      try {
        const result = JSON.parse(line);
        
        if (result.error) {
          logger.warn(`Error in batch result: ${result.error.message}`);
          failureCount++;
          continue;
        }
        
        // Log the structure of the result for debugging
        logger.debug(`Batch result structure: ${JSON.stringify(result)}`);
        
        const customId = result.custom_id;
        
        // The content is nested under result.result.message.content
        let content = null;
        
        if (result.result?.type === 'succeeded' && result.result.message?.content) {
          // Extract from the correct location in the response structure
          const messageContent = result.result.message.content;
          
          if (Array.isArray(messageContent) && messageContent.length > 0) {
            // Find the first text content
            for (const item of messageContent) {
              if (item.type === 'text' && item.text) {
                content = item.text;
                break;
              }
            }
          }
        }
        
        if (!content) {
          // Fallback to previous methods of extraction
          if (result.content && Array.isArray(result.content) && result.content[0]?.text) {
            content = result.content[0].text;
          } else if (typeof result.content === 'string') {
            content = result.content;
          } else if (result.message?.content) {
            // Try different response format
            content = result.message.content;
          } else {
            // Log the entire result for debugging
            logger.warn(`No content found in batch result for custom_id ${customId}: ${JSON.stringify(result)}`);
            failureCount++;
            continue;
          }
        }
        
        if (!content) {
          logger.warn(`No content in batch result for custom_id ${customId}`);
          failureCount++;
          continue;
        }
        
        // Extract, repair, and parse JSON
        const extractedJson = extractJsonFromResponse(content);
        const repairedJson = jsonrepair(extractedJson);
        let parsedData = JSON.parse(repairedJson);
        
        // Check if response has the new lessons array format
        const lessonDataArray = parsedData.lessons || [parsedData];
        
        for (let i = 0; i < lessonDataArray.length; i++) {
          const lessonData = validateAndFixLessonData(lessonDataArray[i]);
          
          // Generate a unique ID for each lesson
          const lessonId = i === 0 ? customId : `${customId}-${i}`;
          
          // Create a Lesson object to save to the database
          const lesson: LessonData = {
            id: lessonId,
            title: lessonData.title,
            theme: lessonData.theme,
            content: formatLessonContent(lessonData.content_points),
            vocabulary: formatVocabulary(lessonData.vocabulary_terms),
            hasVocabulary: lessonData.vocabulary_terms.length > 0,
            createdAt: new Date().toISOString(),
            quizQuestion: lessonData.quiz_question,
            quizOptions: lessonData.quiz_options,
            quizCorrectIndex: lessonData.correct_option_index,
            explanation: lessonData.explanation,
            optionExplanations: lessonData.option_explanations,
            example_link: lessonData.example_link,
            videoQuery: lessonData.video_query,
            pool_type: poolType,
            is_used: false,
            batch_id: batchId
          };
          
          // Save to database
          await lessonRepository.saveLesson(lesson);
          
          successCount++;
          
          // Add delay between processing individual lessons to avoid DB rate limits
          await sleep(100); // Small delay
        }
      } catch (error) {
        logger.error(`Error processing batch result: ${error instanceof Error ? error.message : String(error)}`);
        failureCount++;
      }
    }
    
    // Update batch processing stats
    await updateBatchStats(batchId, poolType, successCount, failureCount);
    
    // Update batch job status to completed
    await updateBatchJobStatus(batchId, 'completed', resultsUrl);
    
    logger.info(`Batch ${batchId} processing completed: ${successCount} successful, ${failureCount} failed`);
  } catch (error) {
    logger.error(`Error processing batch results: ${error instanceof Error ? error.message : String(error)}`);
    await updateBatchStats(batchId, poolType, 0, 0, 'failed');
    
    // Update batch job status to failed
    await updateBatchJobStatus(batchId, 'failed');
  }
}

/**
 * Update batch processing statistics in the database
 */
async function updateBatchStats(
  batchId: string, 
  poolType: PoolType, 
  successCount: number, 
  failureCount: number,
  status: 'completed' | 'failed' = 'completed'
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    // Update pool stats
    const { data: statsData, error: statsError } = await supabase
      .from('lesson_pool_stats')
      .select('*')
      .eq('pool_type', poolType)
      .single();
    
    if (statsError && statsError.code !== 'PGRST116') {
      logger.error(`Error fetching pool stats: ${statsError.message}`);
    }
    
    // If stats don't exist, create them
    if (!statsData) {
      await supabase.from('lesson_pool_stats').insert({
        pool_type: poolType,
        total_lessons: successCount,
        available_lessons: successCount,
        last_generated: new Date().toISOString(),
        batch_id: batchId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } else {
      // Update existing stats
      const totalLessons = statsData.total_lessons + successCount;
      const availableLessons = statsData.available_lessons + successCount;
      
      await supabase
        .from('lesson_pool_stats')
        .update({
          total_lessons: totalLessons,
          available_lessons: availableLessons,
          last_generated: new Date().toISOString(),
          batch_id: batchId,
          updated_at: new Date().toISOString()
        })
        .eq('pool_type', poolType);
    }
    
    logger.info(`Updated pool stats for ${poolType} pool with ${successCount} new lessons`);
  } catch (error) {
    logger.error(`Error updating batch stats: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if a pool needs to be refilled
 * @param poolType - The type of pool to check
 * @returns Boolean indicating if refill is needed
 */
export async function isPoolRefillNeeded(poolType: PoolType): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    
    // Get the current pool stats
    const { data: statsData, error: statsError } = await supabase
      .from('lesson_pool_stats')
      .select('*')
      .eq('pool_type', poolType)
      .single();
    
    if (statsError && statsError.code !== 'PGRST116') {
      logger.error(`Error checking pool stats: ${statsError.message}`);
      return true; // Default to refill on error
    }
    
    // If stats don't exist, need to refill
    if (!statsData) {
      logger.info(`No stats found for ${poolType} pool, refill needed`);
      return true;
    }
    
    // Check if available lessons is below threshold
    const threshold = POOL_MIN_THRESHOLDS[poolType];
    const needsRefill = statsData.available_lessons < threshold;
    
    logger.info(`Pool ${poolType} has ${statsData.available_lessons} available lessons, threshold is ${threshold}, needs refill: ${needsRefill}`);
    
    return needsRefill;
  } catch (error) {
    logger.error(`Error checking if pool refill needed: ${error instanceof Error ? error.message : String(error)}`);
    return true; // Default to refill on error
  }
}

/**
 * Get the number of lessons to generate for a pool refill
 * @param poolType - The type of pool to refill
 * @returns The number of lessons to generate
 */
async function getLessonsToGenerate(poolType: PoolType): Promise<number> {
  try {
    const supabase = getSupabaseClient();
    
    // Get the current pool stats
    const { data: statsData, error: statsError } = await supabase
      .from('lesson_pool_stats')
      .select('*')
      .eq('pool_type', poolType)
      .single();
    
    const poolSize = POOL_SIZES[poolType];
    
    if (statsError && statsError.code !== 'PGRST116') {
      logger.warn(`Error getting pool stats: ${statsError.message}, generating ${poolSize} lessons`);
      return poolSize; // Default to full pool size on error
    }
    
    // If no stats exist, generate full pool
    if (!statsData) {
      logger.info(`No stats found for ${poolType} pool, generating ${poolSize} lessons`);
      return poolSize;
    }
    
    // Calculate how many lessons to generate to fill the pool
    const toGenerate = poolSize - statsData.available_lessons;
    
    return Math.max(0, toGenerate);
  } catch (error) {
    logger.error(`Error calculating lessons to generate: ${error instanceof Error ? error.message : String(error)}`);
    return POOL_SIZES[poolType]; // Default to full pool size on error
  }
}

/**
 * Get recent themes and quizzes to avoid duplicates
 * @returns Arrays of recent themes and quizzes to avoid
 */
async function getRecentThemesAndQuizzes(): Promise<{themesToAvoid: string[], quizzesToAvoid: string[]}> {
  try {
    const recentThemes = await lessonRepository.getRecentThemes();
    const recentQuizzes = await lessonRepository.getRecentQuizzes();
    
    return {
      themesToAvoid: recentThemes,
      quizzesToAvoid: recentQuizzes
    };
  } catch (error) {
    logger.error(`Error getting recent themes and quizzes: ${error instanceof Error ? error.message : String(error)}`);
    return {
      themesToAvoid: [],
      quizzesToAvoid: []
    };
  }
}

/**
 * Format lesson content from array of points to formatted text
 * @param contentPoints - Array of content points
 * @returns Formatted content string
 */
function formatLessonContent(contentPoints: string[]): string {
  if (!contentPoints || contentPoints.length === 0) {
    return "";
  }
  
  return contentPoints.join('\n\n');
}

/**
 * Format vocabulary terms to string
 * @param vocabularyTerms - Array of vocabulary terms
 * @returns Formatted vocabulary string
 */
function formatVocabulary(vocabularyTerms: Array<{term: string, definition: string, example: string}>): string {
  if (!vocabularyTerms || vocabularyTerms.length === 0) {
    return "";
  }
  
  return vocabularyTerms.map(item => {
    return `${item.term}: ${item.definition} Example: ${item.example}`;
  }).join('\n\n');
}

/**
 * Check if a batch job is already running for a pool type
 * @param poolType - The type of pool to check
 * @returns Boolean indicating if a batch is running
 */
async function isBatchRunningForPool(poolType: PoolType): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    
    // Check for any batch jobs that are not completed or failed
    const { data, error } = await supabase
      .from('batch_jobs')
      .select('id')
      .eq('pool_type', poolType)
      .in('status', ['created', 'processing'])
      .limit(1);
    
    if (error) {
      logger.error(`Error checking for running batch jobs: ${error.message}`);
      return false; // Assume no running batch on error
    }
    
    return data && data.length > 0;
  } catch (error) {
    logger.error(`Error checking for running batch jobs: ${error instanceof Error ? error.message : String(error)}`);
    return false; // Assume no running batch on error
  }
}

/**
 * Create a batch job record in the database
 * @param batchId - Our internal batch ID
 * @param anthropicBatchId - The Anthropic batch ID
 * @param poolType - The pool type this batch is for
 * @param lessonCount - Number of lessons in the batch
 * @returns Boolean indicating success
 */
async function createBatchJobRecord(
  batchId: string, 
  anthropicBatchId: string, 
  poolType: PoolType, 
  lessonCount: number
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase.from('batch_jobs').insert({
      id: batchId,
      anthropic_batch_id: anthropicBatchId,
      pool_type: poolType,
      status: 'created',
      lesson_count: lessonCount,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    if (error) {
      logger.error(`Error creating batch job record: ${error.message}`);
      return false;
    }
    
    logger.info(`Created batch job record for batch ${batchId} (Anthropic batch ID: ${anthropicBatchId}) with ${lessonCount} lessons`);
    return true;
  } catch (error) {
    logger.error(`Error creating batch job record: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Update batch job status
 * @param batchId - Our internal batch ID
 * @param status - New status
 * @param resultsUrl - Optional results URL when status is 'completed'
 * @returns Boolean indicating success
 */
export async function updateBatchJobStatus(
  batchId: string, 
  status: 'created' | 'processing' | 'completed' | 'failed',
  resultsUrl?: string
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };
    
    // If completed or failed, set completed_at
    if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }
    
    // If results URL provided, add it
    if (resultsUrl) {
      updateData.results_url = resultsUrl;
    }
    
    const { error } = await supabase
      .from('batch_jobs')
      .update(updateData)
      .eq('id', batchId);
    
    if (error) {
      logger.error(`Error updating batch job status: ${error.message}`);
      return false;
    }
    
    logger.info(`Updated batch job ${batchId} status to ${status}${resultsUrl ? ' with results URL' : ''}`);
    return true;
  } catch (error) {
    logger.error(`Error updating batch job status: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Refill a pool with new lessons
 * @param poolType - The type of pool to refill
 */
export async function refillPool(poolType: PoolType): Promise<void> {
  try {
    logger.info(`Starting pool refill for ${poolType} pool`);
    
    // Check if a batch is already running for this pool
    const isBatchRunning = await isBatchRunningForPool(poolType);
    if (isBatchRunning) {
      logger.info(`A batch is already running for ${poolType} pool, skipping refill`);
      return;
    }
    
    // Check if refill is needed
    const needsRefill = await isPoolRefillNeeded(poolType);
    
    if (!needsRefill) {
      logger.info(`Pool ${poolType} does not need refill, skipping`);
      return;
    }
    
    // Get number of lessons to generate
    const lessonsToGenerate = await getLessonsToGenerate(poolType);
    
    if (lessonsToGenerate <= 0) {
      logger.info(`No lessons need to be generated for ${poolType} pool, skipping`);
      return;
    }
    
    logger.info(`Generating ${lessonsToGenerate} lessons for ${poolType} pool`);
    
    // Get recent themes and quizzes to avoid
    const { themesToAvoid, quizzesToAvoid } = await getRecentThemesAndQuizzes();
    
    // Create batch ID
    const batchId = createBatchId();
    
    // Create requests array for batch
    const systemMessage = getSystemMessage();
    const requests = [];
    
    // Each request will generate exactly 5 lessons
    const lessonsPerRequest = 5;
    
    // Determine number of requests based on environment
    // In development, we use 1 request per batch (5 lessons total)
    // In production, we use up to 5 requests per batch (25 lessons total)
    const isDev = process.env.NODE_ENV !== 'production';
    const maxRequestsPerBatch = isDev ? 1 : 5;
    
    // Calculate number of requests needed, but limit by environment
    let requestCount = Math.ceil(lessonsToGenerate / lessonsPerRequest);
    requestCount = Math.min(requestCount, maxRequestsPerBatch);
    
    logger.info(`Environment: ${isDev ? 'development' : 'production'}, creating ${requestCount} batch requests, expecting ${lessonsPerRequest} lessons per request`);
    
    for (let i = 0; i < requestCount; i++) {
      const lessonId = `lesson-${Date.now()}-${uuidv4().substring(0, 7)}`;
      const prompt = getLessonPrompt(themesToAvoid, quizzesToAvoid);
      
      requests.push({
        custom_id: lessonId,
        params: {
          model: settings.CLAUDE_MODEL,
          max_tokens: 4000, // Increased token limit to accommodate multiple lessons
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          system: systemMessage,
          temperature: 0.5
        }
      });
    }
    
    logger.info(`Created ${requests.length} requests for batch ${batchId}`);
    
    // Create batch request
    try {
      // Apply rate limiting before making the API call
      await batchApiRateLimiter.waitAndConsume(1);
      
      // Use direct fetch to the Anthropic API for batch processing
      const headers = new Headers();
      headers.append('Content-Type', 'application/json');
      headers.append('x-api-key', settings.CLAUDE_API_KEY || '');
      headers.append('anthropic-version', '2023-06-01');
      
      const batchResponse = await fetch('https://api.anthropic.com/v1/messages/batches', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ requests })
      });
      
      if (!batchResponse.ok) {
        const errorText = await batchResponse.text();
        throw new Error(`Failed to create batch: ${batchResponse.status} ${batchResponse.statusText} - ${errorText}`);
      }
      
      const batch = await batchResponse.json();
      
      // Calculate total expected lessons
      const totalExpectedLessons = requests.length * lessonsPerRequest;
      logger.info(`Created batch ${batch.id} with ${requests.length} requests (expecting ${totalExpectedLessons} lessons)`);
      
      // Create batch job record in database
      const batchRecordCreated = await createBatchJobRecord(batchId, batch.id, poolType, totalExpectedLessons);
      
      if (!batchRecordCreated) {
        logger.warn(`Failed to create batch job record, continuing without tracking`);
      }
      
      // Record batch creation in the lesson_pool_stats table
      const supabase = getSupabaseClient();
      await supabase.from('lesson_pool_stats').upsert({
        pool_type: poolType,
        batch_id: batchId,
        last_generated: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'pool_type' });
      
      // Note: Processing of batch results happens asynchronously when Anthropic sends a webhook notification
      
      logger.info(`Pool refill initiated for ${poolType} pool`);
      return;
    } catch (error) {
      logger.error(`Error creating batch request: ${error instanceof Error ? error.message : String(error)}`);
      // Record failed batch in stats
      await updateBatchStats(batchId, poolType, 0, 0, 'failed');
    }
  } catch (error) {
    logger.error(`Error refilling pool: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Mark a lesson as used in the pool
 * @param lessonId - ID of the lesson to mark as used
 */
export async function markLessonAsUsed(lessonId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    // Get the lesson to check its pool type
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('pool_type')
      .eq('id', lessonId)
      .single();
    
    if (lessonError) {
      logger.error(`Error getting lesson for marking as used: ${lessonError.message}`);
      return;
    }
    
    if (!lesson) {
      logger.warn(`Lesson ${lessonId} not found for marking as used`);
      return;
    }
    
    // Update the lesson as used
    const { error: updateError } = await supabase
      .from('lessons')
      .update({
        is_used: true,
        used_at: new Date().toISOString()
      })
      .eq('id', lessonId);
    
    if (updateError) {
      logger.error(`Error marking lesson as used: ${updateError.message}`);
      return;
    }
    
    // Update the pool stats
    const { data: statsData, error: statsError } = await supabase
      .from('lesson_pool_stats')
      .select('available_lessons')
      .eq('pool_type', lesson.pool_type)
      .single();
    
    if (statsError) {
      logger.error(`Error getting pool stats for decrementing: ${statsError.message}`);
      return;
    }
    
    if (statsData) {
      const newAvailable = Math.max(0, statsData.available_lessons - 1);
      
      await supabase
        .from('lesson_pool_stats')
        .update({
          available_lessons: newAvailable,
          updated_at: new Date().toISOString()
        })
        .eq('pool_type', lesson.pool_type);
    }
    
    logger.info(`Marked lesson ${lessonId} as used and updated ${lesson.pool_type} pool stats`);
    
    // Check if pool needs refill after using a lesson
    await checkAndRefillPoolIfNeeded(lesson.pool_type as PoolType);
  } catch (error) {
    logger.error(`Error marking lesson as used: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get an available lesson from the specified pool
 * @param poolType - Type of pool to get lesson from
 * @returns Available lesson or null if none available
 */
export async function getAvailableLessonFromPool(poolType: PoolType): Promise<LessonData | null> {
  try {
    const supabase = getSupabaseClient();
    
    // Get an unused lesson from the specified pool
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('pool_type', poolType)
      .eq('is_used', false)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      logger.error(`Error getting available lesson from pool: ${error.message}`);
      return null;
    }
    
    if (!data || data.length === 0) {
      logger.info(`No available lessons in ${poolType} pool`);
      
      // Try to refill the pool
      await refillPool(poolType);
      
      return null;
    }
    
    // Convert to app model
    return {
      id: data[0].id,
      title: data[0].title,
      theme: data[0].theme,
      content: data[0].content,
      vocabulary: data[0].vocabulary,
      hasVocabulary: data[0].has_vocabulary,
      createdAt: data[0].created_at,
      quizQuestion: data[0].quiz_question,
      quizOptions: data[0].quiz_options,
      quizCorrectIndex: data[0].quiz_correct_index,
      explanation: data[0].explanation,
      optionExplanations: data[0].option_explanations,
      imageUrl: data[0].image_url,
      example_link: data[0].example_link,
      videoQuery: data[0].video_query,
      pool_type: data[0].pool_type,
      is_used: data[0].is_used,
      batch_id: data[0].batch_id
    };
  } catch (error) {
    logger.error(`Error getting available lesson from pool: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Check if a pool needs refill and refill it if needed
 * @param poolType - Type of pool to check
 */
export async function checkAndRefillPoolIfNeeded(poolType: PoolType): Promise<void> {
  const needsRefill = await isPoolRefillNeeded(poolType);
  
  if (needsRefill) {
    await refillPool(poolType);
  }
}

/**
 * Get a specific batch job by ID
 * @param batchId - The batch ID to retrieve
 * @returns The batch job or null if not found
 */
export async function getBatchJob(batchId: string): Promise<any | null> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('batch_jobs')
      .select('*')
      .eq('id', batchId)
      .single();
    
    if (error) {
      logger.error(`Error getting batch job ${batchId}: ${error.message}`);
      return null;
    }
    
    return data;
  } catch (error) {
    logger.error(`Error getting batch job: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Get all batch jobs with optional filters
 * @param status - Optional status filter
 * @param poolType - Optional pool type filter
 * @param limit - Maximum number of jobs to return
 * @returns Array of batch jobs
 */
export async function listBatchJobs(
  status?: 'created' | 'processing' | 'completed' | 'failed',
  poolType?: PoolType,
  limit: number = 20
): Promise<any[]> {
  try {
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('batch_jobs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (poolType) {
      query = query.eq('pool_type', poolType);
    }
    
    const { data, error } = await query;
    
    if (error) {
      logger.error(`Error listing batch jobs: ${error.message}`);
      return [];
    }
    
    return data || [];
  } catch (error) {
    logger.error(`Error listing batch jobs: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Get batch stats summary
 * @returns Summary stats for batches
 */
export async function getBatchStats(): Promise<any> {
  try {
    const supabase = getSupabaseClient();
    
    // Get total count of jobs
    const { count: totalCount, error: totalError } = await supabase
      .from('batch_jobs')
      .select('*', { count: 'exact', head: true });
    
    if (totalError) {
      logger.error(`Error getting total batch job count: ${totalError.message}`);
      return null;
    }
    
    // Get counts for each status
    const statuses = ['created', 'processing', 'completed', 'failed'];
    const counts = [];
    
    for (const status of statuses) {
      const { count, error } = await supabase
        .from('batch_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', status);
      
      if (!error) {
        counts.push({ status, count });
      }
    }
    
    // Get most recent job by pool type
    const { data: recentData, error: recentError } = await supabase
      .from('batch_jobs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10);
    
    if (recentError) {
      logger.error(`Error getting recent batch jobs: ${recentError.message}`);
      return {
        total: totalCount || 0,
        counts,
        recent: []
      };
    }
    
    return {
      total: totalCount || 0,
      counts,
      recent: recentData || []
    };
  } catch (error) {
    logger.error(`Error getting batch stats: ${error instanceof Error ? error.message : String(error)}`);
    return { total: 0, counts: [], recent: [] };
  }
}

export default {
  refillPool,
  isPoolRefillNeeded,
  markLessonAsUsed,
  getAvailableLessonFromPool,
  checkAndRefillPoolIfNeeded,
  getBatchJob,
  listBatchJobs,
  getBatchStats,
  updateBatchJobStatus,
  processBatchResults
}; 
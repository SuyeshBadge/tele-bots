/**
 * OpenAI API client for generating UI/UX lesson content.
 */

import { OpenAI } from 'openai';
import { getChildLogger, logOpenAIResponse } from '../utils/logger';
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
  content: string;           // Kept for backward compatibility
  content_points: string[];  // Array of bullet points
  quiz_question: string;
  quiz_options: string[];
  correct_option_index: number;
  explanation: string;
  option_explanations?: string[];
  vocabulary_terms?: {term: string, definition: string, example: string}[]; // Array of vocabulary terms with definitions and examples
  example_link?: {url: string, description: string}; // Link to a real-world example implementation
  video_link?: {url: string, title: string, description: string}; // Link to a relevant YouTube tutorial video
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
 * @param theme - The theme to generate a lesson for
 * @returns The generated lesson data
 */
async function generateLessonContent(theme: string): Promise<LessonData> {
  // Check cache first
  const themeLower = theme.toLowerCase().trim();
  if (themeLower in _lessonCache) {
    const { timestamp, content } = _lessonCache[themeLower];
    if (Date.now() - timestamp < _cacheTtl * 1000) {
      logger.info(`Using cached lesson for theme: ${theme}`);
      return content;
    }
  }
  
  // If OpenAI is disabled, return fallback lesson immediately
  if (settings.DISABLE_OPENAI) {
    logger.info("OpenAI API disabled, using fallback lesson");
    return getFallbackLesson(theme);
  }
  
  let retryCount = 0;
  const maxRetries = 2; // Reduced from 3 to 2
  
  while (retryCount < maxRetries) {
    try {
      // Generate the prompt for the API call - streamlined for better content
      const prompt = (
        `Generate a beginner-friendly UI/UX design lesson with a **clear, engaging structure**. Follow these strict guidelines:\n\n` +
      
        `1️⃣ **Title**: A short, engaging title (max 10 words).\n\n` +
      
        `2️⃣ **Key Learning Points** (5-7 total):\n` +
        `   - Each must start with a unique, relevant emoji (🎨 for colors, 🖱️ for interaction, 📱 for mobile, etc.).\n` +
        `   - Each point must be **1-2 concise sentences (max 20 words)** to ensure clarity.\n` +
        `   - Avoid repeating emojis and vary the sentence structures.\n\n` +
        
        `3️⃣ **Real-World Example**:\n` +
        `   - Provide a URL to a real website or application that demonstrates this concept in action.\n` +
        `   - Add a brief description (max 20 words) explaining why this example is relevant.\n` +
        `   - Choose well-known, reputable sites that clearly showcase the principles.\n\n` +
        
        `4️⃣ **Vocabulary Terms** (3-5 total):\n` +
        `   - Include key terminology related to the topic.\n` +
        `   - Each term should have a clear, concise definition (max 15 words).\n` +
        `   - Include a short, relatable real-world example for each term (max 15 words).\n` +
        `   - Choose terms that are essential for beginners to understand the topic.\n\n` +
      
        `5️⃣ **Quiz Question**:\n` +
        `   - A multiple-choice question with **exactly 4 answer options**.\n` +
        `   - The question must be **clear, relevant, and beginner-friendly**.\n` +
        `   - Incorrect answers should be **plausible but clearly incorrect** (no trick questions).\n\n` +
      
        `6️⃣ **Explanations for Each Answer**:\n` +
        `   - Explain why the **correct answer is right** in a clear, friendly way (max 40 words).\n` +
        `   - Explain why each **wrong answer is incorrect** in a simple, non-technical way (max 30 words each).\n\n` +
      
        `🚀 **Response Format (JSON, always valid and properly formatted):**\n` +
        `{\n` +
        `  "title": "string (max 10 words)",\n` +
        `  "content_points": ["string (each must start with a unique emoji, max 20 words)"],\n` +
        `  "example_link": {"url": "valid URL", "description": "string (max 20 words)"},\n` +
        `  "vocabulary_terms": [{"term": "string", "definition": "string (max 15 words)", "example": "string (max 15 words)"}],\n` +
        `  "quiz_question": "string",\n` +
        `  "quiz_options": ["string", "string", "string", "string"],\n` +
        `  "correct_option_index": integer (0-3),\n` +
        `  "explanation": "string (max 40 words, explaining the correct answer)",\n` +
        `  "option_explanations": ["string (max 30 words)", "string (max 30 words)", "string (max 30 words)", "string (max 30 words)"]\n` +
        `}\n\n` +
      
        `⚠️ **Important Guidelines**:\n` +
        `- Ensure the response is always **valid JSON** (properly formatted, with no missing brackets or escape errors).\n` +
        `- Use **engaging, friendly, and beginner-appropriate language** (avoid jargon and keep it fun!).\n` +
        `- Keep answers **concise, structured, and varied** (no repeated emojis or phrasing).\n` +
        `- Follow **word limits strictly** to maintain readability and consistency.\n` +
        `- Make vocabulary examples relatable to real design situations that beginners can understand.\n` +
        `- For example links, use real websites or applications that clearly showcase the concept in action.`
      );
      

      // Make the API call with better prompt focused on emojis
      logger.info(`Sending OpenAI request for lesson on theme: '${theme}' with model: ${settings.OPENAI_MODEL}`);
      
      // Record the prompt for logging
      // Define the system message for AI behavior
      const systemMessage = 
        "You are an expert UI/UX educator specializing in creating engaging, beginner-friendly lessons. " +
        "Your task is to generate visually appealing, well-structured content that is easy to understand. " +
        "EVERY key learning point MUST start with a unique, relevant emoji (🎨 for colors, 🖱️ for interaction, 📱 for mobile, etc.). " +
        "Do NOT use generic bullet points—always use appropriate emojis that match the topic. " +
        "Include key vocabulary terms that relate to the topic with clear, concise definitions and practical, relatable examples. " +
        "Your examples should illustrate how the terms are applied in real-world design situations that beginners can understand. " +
        "ALWAYS provide a link to a real, accessible webpage that demonstrates a good implementation of the UI/UX concept being taught. " +
        "Choose well-known, reputable sites that clearly showcase the principles in action. " +
        "Ensure explanations are clear, concise, and formatted for an engaging learning experience.";

      
      // Log if detailed logging is enabled
      logOpenAIResponse(`LESSON SYSTEM PROMPT`, { prompt: systemMessage });
      logOpenAIResponse(`LESSON USER PROMPT`, { prompt: prompt });
      
      logger.debug(`LESSON SYSTEM PROMPT: ${systemMessage}`);
      logger.debug(`LESSON USER PROMPT: ${prompt}`);
      
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
      logOpenAIResponse(`LESSON REQUEST - Theme: '${theme}', Model: ${settings.OPENAI_MODEL}, Tokens: ${totalTokens}`);
      logOpenAIResponse(`LESSON RESPONSE - Raw`, { response: content });
      logger.debug(`LESSON RESPONSE - Raw: ${content}`);
      
      let cleanedContent = content.trim();
      
      // Clean markdown formatting
      if (cleanedContent.includes("```")) {
        cleanedContent = cleanedContent.replace(/```(?:json)?/g, '').trim();
      }
      
      // Try direct JSON parsing
      try {
        const lessonData = JSON.parse(cleanedContent) as LessonData;
        
        // Validate required fields
        const requiredFields = ['title', 'content_points', 'quiz_question', 'quiz_options', 'correct_option_index', 'explanation'];
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
        
        // Validate example_link if it exists
        if (lessonData.example_link) {
          if (typeof lessonData.example_link !== 'object' || lessonData.example_link === null || 
              !('url' in lessonData.example_link) || !('description' in lessonData.example_link)) {
            // If example_link is invalid, provide a default one
            lessonData.example_link = getExampleLinkForTheme(theme);
          } else {
            // Validate URL format
            try {
              new URL(lessonData.example_link.url);
              // URL is valid
            } catch (error) {
              // URL is invalid, provide a default
              lessonData.example_link = getExampleLinkForTheme(theme);
            }
          }
        } else {
          // If example_link is missing, provide a default
          lessonData.example_link = getExampleLinkForTheme(theme);
        }
        
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
          return getFallbackLesson(theme);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      logger.error(`Error generating lesson content: ${error instanceof Error ? error.message : String(error)}`);
      
      retryCount++;
      if (retryCount >= maxRetries) {
        logger.warn(`Maximum retries reached, using fallback lesson for theme: ${theme}`);
        return getFallbackLesson(theme);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Fallback if all else fails
  return getFallbackLesson(theme);
}

/**
 * Get a fallback lesson if OpenAI API is disabled or fails
 * 
 * @param theme - The theme to create a fallback lesson for
 * @returns A basic lesson data object
 */
function getFallbackLesson(theme: string): LessonData {
  // Create content points with emojis included
  const contentPoints = [
    `🎨 ${theme} is an important concept in UI/UX design focused on creating better user experiences`,
    `👤 When implementing ${theme}, always consider your users' needs and expectations first`,
    `🔬 Research and user testing are essential parts of effectively applying ${theme} in your designs`,
    `🧩 Start with simple implementations of ${theme} and iterate based on user feedback`,
    `📱 Study successful products to see how they've incorporated ${theme} principles`,
    `🔄 Maintain consistency in your ${theme} approach across all parts of your interface`
  ];
  
  // Keep the original content format for backward compatibility
  const content = contentPoints.join('\n\n');
  
  // Set up quiz options
  const quizOptions = [
    "Making it look visually impressive",
    "Using user feedback to improve designs",
    "Ignoring accessibility concerns",
    "Following the latest design trends"
  ];
  
  // Correct answer is option 1: "Using user feedback to improve designs"
  const correctOptionIndex = 1;
  
  // Create detailed explanations for each option
  const optionExplanations = [
    "Visual appeal is important, but it should always be balanced with usability. Simply making designs visually impressive without considering usability can lead to poor user experiences. Always prioritize user needs over pure aesthetics.",
    
    "Correct! Using user feedback is essential when implementing any UI/UX design principle. User feedback provides real-world insights into how people interact with your designs and helps you create more effective, user-centered solutions.",
    
    "Accessibility should never be ignored! It's a crucial part of good UI/UX design that ensures your products can be used by everyone, including people with disabilities. Ignoring accessibility limits your user base and can lead to legal issues.",
    
    "While staying aware of trends is valuable, blindly following them without considering if they serve your specific users' needs can lead to poor design choices. Design trends change frequently, but good user experience principles remain consistent."
  ];

  // Add vocabulary terms related to the theme
  const vocabularyTerms = [
    { 
      term: `${theme}`, 
      definition: `A key concept in UI/UX design that enhances user experience and interface quality.`, 
      example: `A checkout flow redesigned using ${theme} principles increased conversion by 20%.` 
    },
    { 
      term: "User feedback", 
      definition: "Information collected from users about their experience with a product.", 
      example: "Surveys showing users found the navigation menu confusing led to a redesign." 
    },
    { 
      term: "Iteration", 
      definition: "The process of repeatedly improving a design based on testing and feedback.", 
      example: "A design team created five versions of a button before finding the optimal solution." 
    },
    { 
      term: "User-centered design", 
      definition: "Design approach that prioritizes users' needs in all design decisions.", 
      example: "Designing a medical app based on interviews with actual healthcare providers." 
    }
  ];

  // Add a real-world example link based on the theme
  const exampleLink = getExampleLinkForTheme(theme);

  return {
    title: `Introduction to ${theme} in UI/UX Design`,
    content,
    content_points: contentPoints,
    quiz_question: `What is the most important consideration when implementing ${theme} in UI/UX design?`,
    quiz_options: quizOptions,
    correct_option_index: correctOptionIndex,
    explanation: `Focusing on user needs and expectations is always the most important aspect of any UI/UX design concept. ${theme} should serve the users, not just look impressive or follow trends.`,
    option_explanations: optionExplanations,
    vocabulary_terms: vocabularyTerms,
    example_link: exampleLink
  };
}

/**
 * Get an appropriate example link based on the theme
 * @param theme The UI/UX design theme
 * @returns An example link object with url and description
 */
function getExampleLinkForTheme(theme: string): {url: string, description: string} {
  // Map of themes to appropriate example links
  const themeExamples: Record<string, {url: string, description: string}> = {
    "UI/UX Principles": {
      url: "https://www.airbnb.com",
      description: "Airbnb uses clear visual hierarchy and intuitive navigation that demonstrates core UI/UX principles."
    },
    "Color Theory": {
      url: "https://stripe.com",
      description: "Stripe's website demonstrates effective use of color to guide users and create visual hierarchy."
    },
    "Typography": {
      url: "https://medium.com",
      description: "Medium uses typography expertly to create readable, scannable content with clear hierarchy."
    },
    "Visual Hierarchy": {
      url: "https://www.apple.com",
      description: "Apple's website exemplifies strong visual hierarchy directing attention to key elements."
    },
    "Responsive Design": {
      url: "https://www.nytimes.com",
      description: "The New York Times website adapts seamlessly across different device sizes."
    },
    "User Research": {
      url: "https://www.gov.uk",
      description: "GOV.UK's design is based on extensive user research, creating simple, accessible interfaces."
    },
    "Accessibility": {
      url: "https://www.gov.uk",
      description: "GOV.UK demonstrates excellent accessibility features following WCAG guidelines."
    },
    "Design Systems": {
      url: "https://material.io",
      description: "Google's Material Design showcases a comprehensive, consistent design system."
    },
    "Navigation Patterns": {
      url: "https://www.amazon.com",
      description: "Amazon's complex navigation system handles millions of products while remaining usable."
    },
    "Form Design": {
      url: "https://www.typeform.com",
      description: "Typeform demonstrates excellent form design with clear, user-friendly interfaces."
    }
  };
  
  // Check if we have a specific example for this theme
  if (theme in themeExamples) {
    return themeExamples[theme];
  }
  
  // If no specific example for this theme, return a default example
  return {
    url: "https://www.nngroup.com/articles/",
    description: `Nielsen Norman Group offers research-backed articles about ${theme} and other UI/UX concepts.`
  };
}

/**
 * Generate a lesson for a UI/UX theme
 * 
 * @param theme - Optional theme for the lesson
 * @returns Lesson content separated by sections
 */
interface LessonSections {
  title: string;
  mainContent: string;
  vocabulary: string;
  hasVocabulary: boolean;
  videoUrl?: string;
  videoTitle?: string;
  videoDescription?: string;
  example_link?: {url: string, description: string};
}

export async function generateLesson(theme?: string): Promise<LessonSections> {
  const lessonTheme = theme || getRandomTheme();
  
  try {
    // Generate lesson content using OpenAI
    const lessonData = await generateLessonContent(lessonTheme);
    
    // Also cache this as a quiz since it contains quiz data
    _quizCache[lessonTheme.toLowerCase().trim()] = {
      timestamp: Date.now(),
      content: {
        question: lessonData.quiz_question,
        options: lessonData.quiz_options,
        correctIndex: lessonData.correct_option_index,
        explanation: lessonData.explanation,
        option_explanations: lessonData.option_explanations || generateDefaultExplanations(lessonData.quiz_options, lessonData.correct_option_index, lessonTheme)
      }
    };
    
    // Format content (OpenAI is already providing emojis in each point)
    let contentString: string;
    
    if (Array.isArray(lessonData.content_points) && lessonData.content_points.length > 0) {
      // Simply join the emoji-enhanced points with proper spacing
      contentString = lessonData.content_points
        .filter(point => point.trim()) // Remove empty points
        .join('\n\n'); // Double newline for better readability
    } else {
      // Fall back to the content string if content_points is not available
      contentString = lessonData.content;
    }
    
    // Add example link if available
    if (lessonData.example_link) {
      contentString += `\n\n<b>🔍 Real-World Example:</b>\n<a href="${lessonData.example_link.url}">${lessonData.example_link.url}</a>\n${lessonData.example_link.description}`;
    }
    
    // Add video link if available
    if (lessonData.video_link) {
      contentString += `\n\n<b>🎥 Watch & Learn:</b>\n<a href="${lessonData.video_link.url}">${lessonData.video_link.title}</a>\n${lessonData.video_link.description}`;
    }
    
    // Format vocabulary terms if available
    let vocabularyString = '';
    let hasVocabulary = false;
    if (Array.isArray(lessonData.vocabulary_terms) && lessonData.vocabulary_terms.length > 0) {
      vocabularyString = '<b>📚 Key Vocabulary</b>\n\n' + 
        lessonData.vocabulary_terms
          .map(item => `<b>${item.term}</b>: ${item.definition}\n<i>Example:</i> ${item.example}`)
          .join('\n\n');
      hasVocabulary = true;
    }
    
    // Format the title
    const titleEmojis = ['✨', '🌟', '💫', '🎨', '🖌️', '🎭']; 
    const randomEmoji = titleEmojis[Math.floor(Math.random() * titleEmojis.length)];
    const formattedTitle = `<b>${randomEmoji} ${lessonData.title} ${randomEmoji}</b>`;
    
    // Return the sections separately
    logger.info(`Successfully formatted lesson on theme: ${lessonTheme} with ${
      Array.isArray(lessonData.content_points) ? lessonData.content_points.length : 0
    } points and ${hasVocabulary ? lessonData.vocabulary_terms?.length : 0} vocabulary terms`);
    
    return {
      title: formattedTitle,
      mainContent: contentString,
      vocabulary: vocabularyString,
      hasVocabulary,
      videoUrl: lessonData.video_link?.url,
      videoTitle: lessonData.video_link?.title,
      videoDescription: lessonData.video_link?.description,
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
    const lessonData = await generateLessonContent(quizTheme);
    
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
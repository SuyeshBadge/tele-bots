/**
 * Configuration settings for the UI/UX Lesson Bot.
 * Loads environment variables and provides configuration values.
 */

import dotenv from 'dotenv';
import path from 'path';
import { validateEnv } from './env.validator';

// Load environment variables
dotenv.config();

// Define the image preference options
export type ImageSource = 'dalle' | 'unsplash' | 'pexels' | 'local';

// Parse image preference order
const parseImagePreference = (value: string): ImageSource[] => {
  if (!value) return ['dalle', 'unsplash', 'pexels', 'local'];
  
  return value.split(',')
    .map(source => source.trim().toLowerCase())
    .filter((source): source is ImageSource => 
      ['dalle', 'unsplash', 'pexels', 'local'].includes(source as string)
    );
};

// Get validated environment config
const env = validateEnv();

// Configuration values
export const settings = {
  // Bot configuration
  TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
  ADMIN_USER_IDS: env.ADMIN_USER_IDS,
  CHANNEL_ID: env.CHANNEL_ID,
  
  // Supabase configuration
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_KEY: env.SUPABASE_KEY,
  ENABLE_SUPABASE: env.ENABLE_SUPABASE,
  
  // OpenAI configuration
  OPENAI_API_KEY: env.OPENAI_API_KEY,
  OPENAI_MODEL: env.OPENAI_MODEL,
  DISABLE_OPENAI: env.DISABLE_OPENAI,
  
  // Claude configuration
  CLAUDE_API_KEY: env.CLAUDE_API_KEY,
  CLAUDE_MODEL: env.CLAUDE_MODEL,
  DISABLE_CLAUDE: env.DISABLE_CLAUDE,
  
  // Logging configuration
  LOG_LEVEL: env.LOG_LEVEL,
  LOG_FILE: env.LOG_FILE,
  
  // Schedule configuration
  MORNING_LESSON_SCHEDULE: env.MORNING_LESSON_SCHEDULE,
  EVENING_LESSON_SCHEDULE: env.EVENING_LESSON_SCHEDULE,
  
  // Feature flags
  ENABLE_QUIZ: env.ENABLE_QUIZ,
  ENABLE_IMAGE_GENERATION: env.ENABLE_IMAGE_GENERATION,
  
  // Image configuration
  ENABLE_DALLE_IMAGES: env.ENABLE_DALLE_IMAGES,
  DALLE_MODEL: env.DALLE_MODEL,
  IMAGE_PREFERENCE: parseImagePreference(env.IMAGE_PREFERENCE),
  UNSPLASH_API_KEY: env.UNSPLASH_API_KEY,
  PEXELS_API_KEY: env.PEXELS_API_KEY,
  
  // Server configuration
  PORT: env.PORT,
  
  // Other settings
  TZ: env.TZ,
  DATA_DIR: env.DATA_DIR,
  DEPLOYMENT_MODE: env.DEPLOYMENT_MODE,
  REQUEST_TIMEOUT: env.REQUEST_TIMEOUT,
  MAX_DAILY_LESSONS: env.MAX_DAILY_LESSONS,
  NEXTLESSON_COOLDOWN: env.NEXTLESSON_COOLDOWN,
  DISABLE_SCHEDULED_LESSONS: env.DISABLE_SCHEDULED_LESSONS,
  MIN_QUIZ_DELAY: env.MIN_QUIZ_DELAY,
  MAX_QUIZ_DELAY: env.MAX_QUIZ_DELAY,
  READING_SPEED_WPM: env.READING_SPEED_WPM,
  DISABLE_SSL_VERIFICATION: env.DISABLE_SSL_VERIFICATION,
  
  // Environment information
  NODE_ENV: env.NODE_ENV,
  
  // YouTube API key
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || '',
};

// Derived settings
export const IS_DEV_MODE = settings.DEPLOYMENT_MODE.toLowerCase() === 'dev';
export const IS_PROD_MODE = settings.DEPLOYMENT_MODE.toLowerCase() === 'prod';
export const DISABLE_DEV_SCHEDULED_LESSONS = IS_DEV_MODE && settings.DISABLE_SCHEDULED_LESSONS;

// File paths
export const BASE_DIR = path.resolve(process.cwd());
export const IMAGES_DIR = path.join(BASE_DIR, 'images');
export const FALLBACK_IMAGES_DIR = path.join(IMAGES_DIR, 'fallback');
export const SUBSCRIBERS_FILE = path.join(settings.DATA_DIR, 'subscribers.json');
export const HEALTH_FILE = path.join(settings.DATA_DIR, 'health.json');

/**
 * UI/UX Themes
 */
export const UI_UX_THEMES = [
  // Fundamentals
  "Color Theory and Psychology",
  "Color Schemes and Palettes",
  "Typography Fundamentals",
  "Visual Hierarchy",
  "Layout and Composition",
  "Whitespace and Negative Space",
  "Grid Systems",
  "Responsive Design",
  "Gestalt Principles",
  
  // User Interface
  "UI Components",
  "Button Design",
  "Form Design",
  "Navigation Patterns",
  "Card Patterns",
  "Modal Windows",
  "Data Tables",
  "Dashboard Design",
  "Mobile UI Patterns",
  
  // User Experience
  "User Research",
  "User Personas",
  "User Journey Mapping",
  "Information Architecture",
  "Wireframing",
  "Prototyping",
  "Usability Testing",
  "Accessibility",
  "Inclusive Design",
  
  // The rest of the themes remain unchanged
  "Design System Fundamentals",
  "Style Guides",
  "Component Libraries",
  "Design Tokens",
  "Design Documentation",
  "Design Version Control",
  "Microinteractions",
  "Feedback Loops",
  "State Changes",
  "Motion Design",
  "Transitions and Animations",
  "Scroll Behaviors",
  "Touch Gestures",
  "Visual Design Principles",
  "Brand Identity in UI",
  "Iconography",
  "Illustration in UI",
  "Photography in UI",
  "Data Visualization",
  "Dark Mode Design",
  "Figma Best Practices",
  "Sketch Best Practices",
  "Adobe XD Best Practices",
  "Prototyping Tools",
  "Design Collaboration",
  "Design Thinking",
  "Design Sprints",
  "Agile for Designers",
  "Design Critique",
  "Design QA",
  "Design Handoff",
  "AR/VR Interface Design",
  "Voice UI Design",
  "Chatbot Design",
  "Wearable UI Design",
  "AI in Design"
];

/**
 * Validate required settings
 * This function now uses the validateEnv function
 */
export function validateSettings(): void {
  validateEnv();
} 
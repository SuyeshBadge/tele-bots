/**
 * Environment Variables Validator
 * 
 * Uses Zod to validate and type the environment variables,
 * ensuring all required variables exist and have the correct format.
 */

import { z } from 'zod';

// Boolean parser for environment variables
const parseBoolean = (value: string | undefined): boolean => {
  if (!value) return false;
  return ['true', '1', 'yes', 'True'].includes(value);
};

// Define the environment schema
export const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Telegram Bot API
  TELEGRAM_BOT_TOKEN: z.string().min(20),
  ADMIN_USER_IDS: z.string().transform(s => s.split(',').map(id => parseInt(id.trim(), 10))),
  CHANNEL_ID: z.string().optional(),
  
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_KEY: z.string().min(20),
  ENABLE_SUPABASE: z.string().transform(parseBoolean).default('True'),
  
  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4-turbo'),
  DISABLE_OPENAI: z.string().transform(parseBoolean).default('False'),
  
  // Logging
  LOG_LEVEL: z.string().default('INFO'),
  LOG_FILE: z.string().default('./logs/bot.log'),
  
  // Schedule
  MORNING_LESSON_SCHEDULE: z.string().default('0 10 * * *'),
  EVENING_LESSON_SCHEDULE: z.string().default('0 18 * * *'),
  
  // Feature flags
  ENABLE_QUIZ: z.string().transform(parseBoolean).default('true'),
  ENABLE_IMAGE_GENERATION: z.string().transform(parseBoolean).default('true'),
  
  // Image configuration
  ENABLE_DALLE_IMAGES: z.string().transform(parseBoolean).default('true'),
  DALLE_MODEL: z.string().default('dall-e-3'),
  IMAGE_PREFERENCE: z.string().default('dalle,unsplash,pexels,local'),
  UNSPLASH_API_KEY: z.string().optional(),
  PEXELS_API_KEY: z.string().optional(),
  
  // Server configuration
  PORT: z.string().transform(val => parseInt(val, 10)).default('8080'),
  
  // Other settings
  TZ: z.string().default('Asia/Kolkata'),
  DATA_DIR: z.string().default('./data'),
  DEPLOYMENT_MODE: z.string().default('prod'),
  REQUEST_TIMEOUT: z.string().transform(val => parseInt(val, 10)).default('30'),
  MAX_DAILY_LESSONS: z.string().transform(val => parseInt(val, 10)).default('5'),
  NEXTLESSON_COOLDOWN: z.string().transform(val => parseInt(val, 10)).default('3600'),
  DISABLE_SCHEDULED_LESSONS: z.string().transform(parseBoolean).default('false'),
  MIN_QUIZ_DELAY: z.string().transform(val => parseInt(val, 10)).default('15'),
  MAX_QUIZ_DELAY: z.string().transform(val => parseInt(val, 10)).default('30'),
  READING_SPEED_WPM: z.string().transform(val => parseInt(val, 10)).default('200'),
  DISABLE_SSL_VERIFICATION: z.string().transform(parseBoolean).default('false'),
});

// Create a type from the schema
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates environment variables and returns a typed configuration object
 */
export function validateEnv(): EnvConfig {
  try {
    // Extract environment variables
    const env = {
      NODE_ENV: process.env.NODE_ENV,
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      ADMIN_USER_IDS: process.env.ADMIN_USER_IDS || '',
      CHANNEL_ID: process.env.CHANNEL_ID,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_KEY: process.env.SUPABASE_KEY,
      ENABLE_SUPABASE: process.env.ENABLE_SUPABASE || 'True',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_MODEL: process.env.OPENAI_MODEL,
      DISABLE_OPENAI: process.env.DISABLE_OPENAI || 'False',
      LOG_LEVEL: process.env.LOG_LEVEL,
      LOG_FILE: process.env.LOG_FILE,
      MORNING_LESSON_SCHEDULE: process.env.MORNING_LESSON_SCHEDULE,
      EVENING_LESSON_SCHEDULE: process.env.EVENING_LESSON_SCHEDULE,
      ENABLE_QUIZ: process.env.ENABLE_QUIZ || 'true',
      ENABLE_IMAGE_GENERATION: process.env.ENABLE_IMAGE_GENERATION || 'true',
      ENABLE_DALLE_IMAGES: process.env.ENABLE_DALLE_IMAGES,
      DALLE_MODEL: process.env.DALLE_MODEL,
      IMAGE_PREFERENCE: process.env.IMAGE_PREFERENCE,
      UNSPLASH_API_KEY: process.env.UNSPLASH_API_KEY,
      PEXELS_API_KEY: process.env.PEXELS_API_KEY,
      PORT: process.env.PORT,
      TZ: process.env.TZ,
      DATA_DIR: process.env.DATA_DIR,
      DEPLOYMENT_MODE: process.env.DEPLOYMENT_MODE,
      REQUEST_TIMEOUT: process.env.REQUEST_TIMEOUT,
      MAX_DAILY_LESSONS: process.env.MAX_DAILY_LESSONS,
      NEXTLESSON_COOLDOWN: process.env.NEXTLESSON_COOLDOWN,
      DISABLE_SCHEDULED_LESSONS: process.env.DISABLE_SCHEDULED_LESSONS,
      MIN_QUIZ_DELAY: process.env.MIN_QUIZ_DELAY,
      MAX_QUIZ_DELAY: process.env.MAX_QUIZ_DELAY,
      READING_SPEED_WPM: process.env.READING_SPEED_WPM,
      DISABLE_SSL_VERIFICATION: process.env.DISABLE_SSL_VERIFICATION,
    };
    
    // Validate with the schema
    return envSchema.parse(env);
  } catch (error) {
    // Format Zod errors nicely
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .filter(e => e.code === 'invalid_type' && e.received === 'undefined')
        .map(e => e.path.join('.'));
      
      const invalidVars = error.errors
        .filter(e => !(e.code === 'invalid_type' && e.received === 'undefined'))
        .map(e => `${e.path.join('.')}: ${e.message}`);
      
      if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
      }
      
      if (invalidVars.length > 0) {
        throw new Error(`Invalid environment variables: ${invalidVars.join(', ')}`);
      }
    }
    
    throw error;
  }
} 
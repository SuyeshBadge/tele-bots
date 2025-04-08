import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@app/utils/logger';
import dotenv from 'dotenv';

dotenv.config();

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase client
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and key must be provided in environment variables');
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  
  return supabaseClient;
}

/**
 * Initialize the database schema
 */
export async function initSupabaseSchema(): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    logger.info('Initializing Supabase schema...');
    
    // Check and create lessons table
    await ensureLessonsTable(supabase);
    
    // Check and create quizzes table
    await ensureQuizzesTable(supabase);
    
    // Check and create subscribers table
    await ensureSubscribersTable(supabase);
    
    // Check and create health table
    await ensureHealthTable(supabase);
    
    // Check and create lesson_delivery table
    await ensureLessonDeliveryTable(supabase);
    
    // Check and create quiz_deliveries table
    await ensureQuizDeliveriesTable(supabase);
    
    logger.info('Supabase schema initialization completed');
  } catch (error) {
    logger.error(`Failed to initialize Supabase schema: ${error instanceof Error ? error.message : String(error)}`);
    // Don't exit the process, just log the error
  }
}

/**
 * Ensure lessons table exists with correct schema
 */
async function ensureLessonsTable(supabase: SupabaseClient): Promise<void> {
  try {
    // Check if table exists by trying to select from it
    const { error: checkError } = await supabase
      .from('lessons')
      .select('id')
      .limit(1);
    
    if (checkError && checkError.code === '42P01') { // Table doesn't exist code
      // Create the table using SQL
      const { error: createError } = await supabase.rpc('create_lessons_table', {});
      
      if (createError) {
        // Table doesn't exist and RPC failed, likely because the function doesn't exist
        logger.warn(`Failed to create lessons table via RPC: ${createError.message}`);
        logger.info('Note: You need to manually create the lessons table in Supabase with the correct schema');
      } else {
        logger.info('Created lessons table');
      }
    } else if (checkError) {
      logger.warn(`Issue checking lessons table: ${checkError.message}`);
    } else {
      logger.info('Lessons table exists');
    }
  } catch (error) {
    logger.warn(`Error ensuring lessons table: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Ensure quizzes table exists with correct schema
 */
async function ensureQuizzesTable(supabase: SupabaseClient): Promise<void> {
  try {
    // Check if table exists by trying to select from it
    const { error: checkError } = await supabase
      .from('quizzes')
      .select('poll_id')
      .limit(1);
    
    if (checkError && checkError.code === '42P01') { // Table doesn't exist code
      // Create the table using SQL
      const { error: createError } = await supabase.rpc('create_quizzes_table', {});
      
      if (createError) {
        // Table doesn't exist and RPC failed, likely because the function doesn't exist
        logger.warn(`Failed to create quizzes table via RPC: ${createError.message}`);
        logger.info('Note: You need to manually create the quizzes table in Supabase with the correct schema');
      } else {
        logger.info('Created quizzes table');
      }
    } else if (checkError) {
      logger.warn(`Issue checking quizzes table: ${checkError.message}`);
    } else {
      logger.info('Quizzes table exists');
    }
  } catch (error) {
    logger.warn(`Error ensuring quizzes table: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Ensure subscribers table exists with correct schema
 */
async function ensureSubscribersTable(supabase: SupabaseClient): Promise<void> {
  try {
    // Check if table exists by trying to select from it
    const { error: checkError } = await supabase
      .from('subscribers')
      .select('id')
      .limit(1);
    
    if (checkError && checkError.code === '42P01') { // Table doesn't exist code
      // Create the table using SQL
      const { error: createError } = await supabase.rpc('create_subscribers_table', {});
      
      if (createError) {
        // Table doesn't exist and RPC failed, likely because the function doesn't exist
        logger.warn(`Failed to create subscribers table via RPC: ${createError.message}`);
        logger.info('Note: You need to manually create the subscribers table in Supabase with the correct schema');
      } else {
        logger.info('Created subscribers table');
      }
    } else if (checkError) {
      logger.warn(`Issue checking subscribers table: ${checkError.message}`);
    } else {
      logger.info('Subscribers table exists');
    }
  } catch (error) {
    logger.warn(`Error ensuring subscribers table: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Ensure health table exists with correct schema
 */
async function ensureHealthTable(supabase: SupabaseClient): Promise<void> {
  try {
    // Check if table exists by trying to select from it
    const { error: checkError } = await supabase
      .from('health')
      .select('version')
      .limit(1);
    
    if (checkError && checkError.code === '42P01') { // Table doesn't exist code
      // Try alternative table name that might exist in the database
      const { error: altCheckError } = await supabase
        .from('health_status')
        .select('version')
        .limit(1);
      
      if (!altCheckError) {
        logger.info('Found health_status table instead of health table - will use this table');
        return;
      }
      
      // Create the table using SQL
      const { error: createError } = await supabase.rpc('create_health_table', {});
      
      if (createError) {
        // Table doesn't exist and RPC failed, likely because the function doesn't exist
        logger.warn(`Failed to create health table via RPC: ${createError.message}`);
        logger.info('Note: You need to manually create the health table in Supabase with the correct schema');
      } else {
        logger.info('Created health table');
      }
    } else if (checkError) {
      logger.warn(`Issue checking health table: ${checkError.message}`);
    } else {
      logger.info('Health table exists');
    }
  } catch (error) {
    logger.warn(`Error ensuring health table: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Ensure lesson_delivery table exists with correct schema
 */
async function ensureLessonDeliveryTable(supabase: SupabaseClient): Promise<void> {
  try {
    // Check if table exists by trying to select from it
    const { error: checkError } = await supabase
      .from('lesson_delivery')
      .select('user_id')
      .limit(1);
    
    if (checkError && checkError.code === '42P01') { // Table doesn't exist code
      // Try alternative table name that might exist in the database
      const { error: altCheckError } = await supabase
        .from('user_lessons')
        .select('user_id')
        .limit(1);
      
      if (!altCheckError) {
        logger.info('Found user_lessons table instead of lesson_delivery table - will use this table');
        return;
      }
      
      // Create the table using SQL
      const { error: createError } = await supabase.rpc('create_lesson_delivery_table', {});
      
      if (createError) {
        // Table doesn't exist and RPC failed, likely because the function doesn't exist
        logger.warn(`Failed to create lesson_delivery table via RPC: ${createError.message}`);
        logger.info('Note: You need to manually create the lesson_delivery table in Supabase with the correct schema');
      } else {
        logger.info('Created lesson_delivery table');
      }
    } else if (checkError) {
      logger.warn(`Issue checking lesson_delivery table: ${checkError.message}`);
    } else {
      logger.info('Lesson delivery table exists');
    }
  } catch (error) {
    logger.warn(`Error ensuring lesson_delivery table: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Ensure quiz_deliveries table exists with correct schema
 */
async function ensureQuizDeliveriesTable(supabase: SupabaseClient): Promise<void> {
  try {
    // Check if table exists by trying to select from it
    const { error: checkError } = await supabase
      .from('quiz_deliveries')
      .select('id')
      .limit(1);
    
    if (checkError && checkError.code === '42P01') { // Table doesn't exist code
      // Create the table using SQL
      const { error: createError } = await supabase.rpc('create_quiz_deliveries_table', {});
      
      if (createError) {
        // Table doesn't exist and RPC failed, likely because the function doesn't exist
        logger.warn(`Failed to create quiz_deliveries table via RPC: ${createError.message}`);
        logger.info('Note: You need to manually create the quiz_deliveries table in Supabase with the correct schema');
      } else {
        logger.info('Created quiz_deliveries table');
      }
    } else if (checkError) {
      logger.warn(`Issue checking quiz_deliveries table: ${checkError.message}`);
    } else {
      logger.info('Quiz deliveries table exists');
    }
  } catch (error) {
    logger.warn(`Error ensuring quiz_deliveries table: ${error instanceof Error ? error.message : String(error)}`);
  }
} 
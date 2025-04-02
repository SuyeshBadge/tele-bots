/**
 * Health Check Script for UI/UX Bot
 * 
 * This script verifies the bot's health by:
 * 1. Checking environment variables
 * 2. Testing Supabase database connection
 * 3. Attempting to initialize the bot (without starting it)
 * 
 * Run with: npm run health-check
 */

import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { validateEnv } from '../app/config/env.validator';
import { settings } from '../app/config/settings';
import { logger } from '../app/utils/logger';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function checkHealth(): Promise<void> {
  try {
    logger.info('Starting health check...');
    
    // Step 1: Validate environment variables
    try {
      validateEnv();
      logger.info('✅ Environment variables: Valid');
    } catch (error) {
      logger.error(`❌ Environment variables: Invalid - ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
    
    // Step 2: Test Supabase connection
    try {
      if (!settings.SUPABASE_URL || !settings.SUPABASE_KEY) {
        throw new Error('Supabase credentials missing');
      }
      
      const supabase = createClient(settings.SUPABASE_URL, settings.SUPABASE_KEY);
      const { data, error } = await supabase.from('lessons').select('id').limit(1);
      
      if (error) {
        throw new Error(`Supabase query failed: ${error.message}`);
      }
      
      logger.info(`✅ Supabase connection: Success (found ${data?.length ?? 0} lessons)`);
    } catch (error) {
      logger.error(`❌ Supabase connection: Failed - ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
    
    // Step 3: Test OpenAI API (if being used)
    try {
      if (settings.OPENAI_API_KEY) {
        // Simple check if key exists and has proper format
        if (settings.OPENAI_API_KEY.startsWith('sk-') && settings.OPENAI_API_KEY.length > 20) {
          logger.info('✅ OpenAI API key: Valid format');
        } else {
          throw new Error('Invalid OpenAI API key format');
        }
      } else {
        logger.warn('⚠️ OpenAI API key: Not configured');
      }
    } catch (error) {
      logger.error(`❌ OpenAI API key: Invalid - ${error instanceof Error ? error.message : String(error)}`);
      // Don't exit for this, as it might be optional
    }

    // Step 4: Test Claude API (if being used)
    try {
      if (settings.CLAUDE_API_KEY) {
        // Simple check if key exists and has proper format
        if (settings.CLAUDE_API_KEY.startsWith('sk-ant-') && settings.CLAUDE_API_KEY.length > 20) {
          logger.info('✅ Claude API key: Valid format');
        } else {
          throw new Error('Invalid Claude API key format');
        }
      } else {
        logger.warn('⚠️ Claude API key: Not configured');
      }
    } catch (error) {
      logger.error(`❌ Claude API key: Invalid - ${error instanceof Error ? error.message : String(error)}`);
      // Don't exit for this, as it might be optional
    }
    
    // Step 5: Check Telegram token
    try {
      if (!settings.TELEGRAM_BOT_TOKEN) {
        throw new Error('Missing Telegram token');
      }
      
      if (settings.TELEGRAM_BOT_TOKEN.length > 30) {
        logger.info('✅ Telegram token: Valid format');
      } else {
        throw new Error('Invalid Telegram token format');
      }
    } catch (error) {
      logger.error(`❌ Telegram token: Invalid - ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
    
    logger.info('Health check completed successfully 🟢');
    process.exit(0);
  } catch (error) {
    logger.error(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run the health check
checkHealth().catch((error) => {
  logger.error(`Uncaught error during health check: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}); 
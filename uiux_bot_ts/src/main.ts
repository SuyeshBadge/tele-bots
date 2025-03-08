#!/usr/bin/env node
/**
 * UI/UX Lesson Telegram Bot - Main Entry Point
 *
 * This bot provides educational UI/UX lessons twice a day (10:00 and 18:00 IST).
 * It also includes quizzes to engage users and can generate custom images for lessons.
 *
 * TypeScript version of the original Python UI/UX bot.
 * 
 * Run with --dev flag to enable development mode with hot reload.
 */

// Print Node.js version
console.log(`Node.js version: ${process.version}`);
console.log('Loading main modules...');

// Import dependencies
import 'module-alias/register';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from './app/utils/logger';
import { UIUXLessonBot } from './app/bot/bot';
import { validateEnv } from './app/config/env.validator';
import { ensureDataInSupabase } from './app/utils/supabase-migration';
import { initPersistence } from './app/utils/persistence';
import { initSupabaseSchema } from './app/utils/supabase';
import { healthServer } from './app/api/health-server';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const isDev = args.includes('--dev');

/**
 * Global error handlers for uncaught exceptions and unhandled rejections
 */
function setupGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error) => {
    logger.error(`UNCAUGHT EXCEPTION: ${error.message}`, {
      stack: error.stack,
      name: error.name
    });
    // Exit with error code for container restart
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error(`UNHANDLED REJECTION: ${error.message}`, {
      stack: error.stack,
      name: error.name
    });
    // In production we want to exit and have the container restart
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });
}

/**
 * Start the health check server for Fly.io
 */
function startHealthServer(bot: UIUXLessonBot): void {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
  
  // Set the bot instance for metrics
  healthServer.setBotInstance(bot);
  
  // Start with initial health status as false (will be set to true after successful startup)
  healthServer.setHealthy(false);
  
  // Start the server
  healthServer.start(port);
  
  logger.info(`Health server started on port ${port}`);
}

/**
 * Main entry point for the bot
 */
async function main(): Promise<void> {
  // Handle dev mode
  if (isDev) {
    console.log('Development mode enabled, starting with hot reload...');
    try {
      const hotReload = await import('./hot-reload');
      hotReload.startHotReload();
      return; // Exit this function, hot reload will start a new process
    } catch (error) {
      console.error('Failed to start hot reload:', error);
      process.exit(1);
    }
  }

  let bot: UIUXLessonBot | null = null;

  try {
    // Set up global error handlers
    setupGlobalErrorHandlers();
    
    logger.info('Starting UI/UX Lesson Bot...');
    
    // Validate environment variables first
    const env = validateEnv();
    logger.info(`Running in ${env.NODE_ENV} mode`);
    
    // First, initialize the database schema
    await initSupabaseSchema();
    logger.info('Supabase schema initialized');
    
    // Then, ensure Supabase is configured and all data is migrated
    await ensureDataInSupabase();
    logger.info('Data migration complete');
    
    // Initialize persistence with Supabase
    await initPersistence();
    logger.info('Persistence layer initialized');
    
    // Start the health server
    bot = new UIUXLessonBot();
    startHealthServer(bot);
    
    // Initialize and start the bot
    await bot.start();
    
    // Setup signal handlers for graceful shutdown
    setupSignalHandlers(bot);
    
    // Mark the application as healthy
    healthServer.setHealthy(true);
    
    logger.info('Bot is running. Press CTRL+C to stop.');
  } catch (error) {
    logger.error(`Failed to start bot: ${error instanceof Error ? error.message : String(error)}`);
    logger.error(`Stack trace: ${error instanceof Error ? error.stack : 'No stack trace'}`);
    
    // Make sure the health check fails if bot failed to start
    healthServer.setHealthy(false);
    
    process.exit(1);
  }
}

/**
 * Set up signal handlers for graceful shutdown
 */
function setupSignalHandlers(bot: UIUXLessonBot): void {
  // Handle termination signals
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down...`);
      try {
        // Set health status to false during shutdown
        healthServer.setHealthy(false);
        
        // Set a timeout to force exit if shutdown takes too long
        const forceExitTimeout = setTimeout(() => {
          logger.error('Shutdown timed out after 10 seconds, forcing exit');
          process.exit(1);
        }, 10000);
        
        // Attempt graceful shutdown
        await bot.shutdown();
        
        // Stop the health server
        await healthServer.stop();
        
        // Clear the force exit timeout
        clearTimeout(forceExitTimeout);
        
        logger.info('Bot shutdown complete. Exiting...');
        process.exit(0);
      } catch (error) {
        logger.error(`Error during shutdown: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
  }
}

// Check if this file is being run directly
if (require.main === module) {
  main().catch((error) => {
    logger.error(`Uncaught error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}

// Export for testing purposes
export { main }; 
/**
 * Initialize lesson pools script
 * 
 * This script initializes both scheduled and on-demand lesson pools.
 * It runs the database migration and then triggers the initial pool fill.
 */

import path from 'path';
import dotenv from 'dotenv';
import { getChildLogger } from '../app/utils/logger';
import { runMigration } from '../database/migrator';
import batchProcessor from '../app/api/batch-processor';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Configure logger
const logger = getChildLogger('init-pools');

/**
 * Initialize both pools
 */
async function initializePools(): Promise<void> {
  try {
    logger.info('Starting pool initialization');
    
    // Run migration first to ensure database schema is updated
    logger.info('Running database migration');
    await runMigration('002_add_pool_management.sql');
    
    // Initialize scheduled pool
    logger.info('Initializing scheduled lesson pool');
    await batchProcessor.refillPool('scheduled');
    
    // Initialize on-demand pool
    logger.info('Initializing on-demand lesson pool');
    await batchProcessor.refillPool('on-demand');
    
    logger.info('Pool initialization complete - pools are being filled asynchronously');
    logger.info('Check database for lesson_pool_stats to monitor progress');
    
  } catch (error) {
    logger.error(`Error initializing pools: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run initialization
initializePools().catch(error => {
  logger.error(`Uncaught error in initialization: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}); 
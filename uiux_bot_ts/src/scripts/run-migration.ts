/**
 * Run migration script
 * 
 * This script runs a specific database migration.
 */

import path from 'path';
import dotenv from 'dotenv';
import { getChildLogger } from '../app/utils/logger';
import { runMigration } from '../database/migrator';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Configure logger
const logger = getChildLogger('run-migration');

/**
 * Run the migration
 */
async function runMigrationScript(): Promise<void> {
  try {
    logger.info('Starting migration');
    
    // Run the lesson delivery functions migration
    await runMigration('003_add_lesson_delivery_functions.sql');
    
    logger.info('Migration completed successfully');
  } catch (error) {
    logger.error(`Error running migration: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run the script
runMigrationScript(); 
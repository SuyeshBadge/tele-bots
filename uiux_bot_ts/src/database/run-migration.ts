/**
 * Database Migration Utility
 * 
 * Script to run all database migrations.
 */

import { runAllMigrations, runMigration } from './migrator';
import { getChildLogger } from '../app/utils/logger';

// Configure logger
const logger = getChildLogger('db-migration');

// Parse command-line arguments
const [,,migrationName] = process.argv;

async function main(): Promise<void> {
  try {
    if (migrationName) {
      // Run a specific migration
      logger.info(`Running specific migration: ${migrationName}`);
      await runMigration(migrationName);
    } else {
      // Run all migrations
      logger.info('Running all migrations');
      await runAllMigrations();
    }
    
    logger.info('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run the migrations
main().catch(error => {
  logger.error(`Uncaught error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}); 
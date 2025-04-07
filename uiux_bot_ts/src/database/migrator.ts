/**
 * Database migrator
 * 
 * Utility for running database migrations.
 */

import fs from 'fs';
import path from 'path';
import { getChildLogger } from '../app/utils/logger';
import { getSupabaseClient } from './supabase-client';

// Configure logger
const logger = getChildLogger('db-migrator');

/**
 * Run a specific migration by filename
 * @param migrationFile - The name of the migration file (e.g., 001_create_tables.sql)
 */
export async function runMigration(migrationFile: string): Promise<void> {
  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    const filePath = path.join(migrationsDir, migrationFile);
    
    // Check if migration file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Migration file not found: ${filePath}`);
    }
    
    // Read the migration file
    const migrationSql = fs.readFileSync(filePath, 'utf8');
    
    // Get Supabase client
    const supabase = getSupabaseClient();
    
    // Execute the migration
    logger.info(`Running migration: ${migrationFile}`);
    const { error } = await supabase.rpc('pg_execute_migration', { 
      sql_migration: migrationSql,
      migration_name: migrationFile 
    });
    
    if (error) {
      throw new Error(`Migration failed: ${error.message}`);
    }
    
    logger.info(`Migration completed successfully: ${migrationFile}`);
  } catch (error) {
    logger.error(`Migration error: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Run all pending migrations
 */
export async function runAllMigrations(): Promise<void> {
  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    
    // Get the list of migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to ensure migrations run in order
    
    // Run each migration
    for (const file of files) {
      await runMigration(file);
    }
    
    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error(`Migrations error: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
} 
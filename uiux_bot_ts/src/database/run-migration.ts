import { getSupabaseClient } from './supabase-client';
import { logger } from '../app/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  try {
    const supabase = getSupabaseClient();
    const migrationPath = path.join(__dirname, 'migrations', '001_add_lesson_columns.sql');
    
    // Read the migration SQL
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSql });
    
    if (error) {
      logger.error(`Migration failed: ${error.message}`);
      process.exit(1);
    }
    
    logger.info('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

runMigration(); 
#!/usr/bin/env node

/**
 * Supabase Migration Script
 * 
 * This script migrates all local data to Supabase and cleans up local files.
 * It should be run once when transitioning from local file storage to Supabase.
 */

import * as dotenv from 'dotenv';
import chalk from 'chalk';
import readline from 'readline';
import { ensureDataInSupabase } from '../app/utils/supabase-migration';

// Load environment variables
dotenv.config();

// Create readline interface for user interaction
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Main function
 */
async function main() {
  console.log(chalk.blue('='.repeat(80)));
  console.log(chalk.blue.bold('UI/UX Lesson Bot - Supabase Migration Utility'));
  console.log(chalk.blue('='.repeat(80)));
  console.log();
  
  // Check if required environment variables are set
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error(chalk.red('ERROR: Supabase configuration is missing.'));
    console.error(chalk.yellow('Please make sure the following environment variables are set:'));
    console.error(chalk.yellow('- SUPABASE_URL'));
    console.error(chalk.yellow('- SUPABASE_KEY'));
    console.error(chalk.yellow('These can be set in a .env file or directly in your environment.'));
    process.exit(1);
  }
  
  if (process.env.ENABLE_SUPABASE !== 'true') {
    console.warn(chalk.yellow('WARNING: ENABLE_SUPABASE is not set to "true" in your environment.'));
    console.warn(chalk.yellow('This script will set it temporarily, but you should update your .env file.'));
    process.env.ENABLE_SUPABASE = 'true';
  }
  
  // Show warning and confirmation
  console.log(chalk.yellow('⚠️  WARNING: This script will migrate all local data to Supabase and then delete the local files.'));
  console.log(chalk.yellow('Make sure your Supabase project is properly configured with the correct schema.'));
  console.log(chalk.yellow('This operation cannot be undone.'));
  console.log();
  
  // Ask for confirmation
  await new Promise<void>((resolve) => {
    rl.question(chalk.bold('Do you want to proceed? (yes/no): '), (answer) => {
      if (answer.toLowerCase() !== 'yes') {
        console.log(chalk.blue('Migration cancelled.'));
        process.exit(0);
      }
      resolve();
    });
  });
  
  console.log();
  console.log(chalk.blue('Starting migration...'));
  
  try {
    // Run the migration
    await ensureDataInSupabase();
    
    console.log();
    console.log(chalk.green('✅ Migration completed successfully!'));
    console.log(chalk.green('All data has been migrated to Supabase and local files have been cleaned up.'));
    console.log();
    console.log(chalk.blue('Next steps:'));
    console.log('1. Make sure ENABLE_SUPABASE=true is set in your .env file');
    console.log('2. Start your bot normally - it will now use Supabase exclusively');
    console.log();
  } catch (error) {
    console.error(chalk.red('❌ Migration failed:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    console.error();
    console.error(chalk.yellow('Please check your Supabase configuration and try again.'));
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the main function
main().catch((error) => {
  console.error(chalk.red('Unhandled error:'));
  console.error(chalk.red(error instanceof Error ? error.stack || error.message : String(error)));
  process.exit(1);
}); 
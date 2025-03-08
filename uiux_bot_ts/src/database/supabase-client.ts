/**
 * Supabase client for the UI/UX Lesson Bot
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getChildLogger } from '../app/utils/logger';
import { settings } from '../app/config/settings';
import { Subscriber, HealthStatus } from '../app/utils/persistence';

// Configure logger
const logger = getChildLogger('supabase');

// Singleton instance of the Supabase client
let supabaseClient: SupabaseClient | null = null;

/**
 * Get Supabase client instance
 * 
 * @returns Supabase client
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      if (process.env.REQUIRE_SUPABASE !== 'false') {
        const errorMessage = 'FATAL ERROR: Supabase URL and key are required. Set SUPABASE_URL and SUPABASE_KEY in environment.';
        console.error('\x1b[31m%s\x1b[0m', errorMessage);
        // Import logger dynamically to avoid circular dependencies
        try {
          const { logger } = require('../app/utils/logger');
          logger.error(errorMessage);
        } catch (e) {
          // Fallback if logger is not available
          console.error('Could not load logger:', e);
        }
        process.exit(1); // Exit with error code
      } else {
        console.warn('WARNING: Supabase URL and key not found. Some features may not work.');
      }
    }
    
    supabaseClient = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_KEY || ''
    );
  }
  
  return supabaseClient;
}

/**
 * Save subscribers to Supabase
 * 
 * @param subscribers - Array of subscribers to save
 * @returns True if successful, false otherwise
 */
export async function saveSubscribersToSupabase(subscribers: Subscriber[]): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    
    // First, delete all existing subscribers
    const { error: deleteError } = await supabase
      .from('subscribers')
      .delete()
      .neq('id', 0); // Delete all rows
    
    if (deleteError) {
      logger.error(`Error deleting subscribers: ${deleteError.message}`);
      return false;
    }
    
    // Then, insert all subscribers
    const { error: insertError } = await supabase
      .from('subscribers')
      .insert(subscribers);
    
    if (insertError) {
      logger.error(`Error inserting subscribers: ${insertError.message}`);
      return false;
    }
    
    logger.info(`Saved ${subscribers.length} subscribers to Supabase`);
    return true;
    
  } catch (error) {
    logger.error(`Error saving subscribers to Supabase: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Load subscribers from Supabase
 * 
 * @returns Array of subscribers, or null if an error occurred
 */
export async function loadSubscribersFromSupabase(): Promise<Subscriber[] | null> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('subscribers')
      .select('*');
    
    if (error) {
      logger.error(`Error loading subscribers: ${error.message}`);
      return null;
    }
    
    logger.info(`Loaded ${data.length} subscribers from Supabase`);
    return data as Subscriber[];
    
  } catch (error) {
    logger.error(`Error loading subscribers from Supabase: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Update health status in Supabase
 * 
 * @param health - Health status to update
 * @returns True if successful, false otherwise
 */
export async function updateHealthStatusInSupabase(health: HealthStatus): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    
    // First, delete all existing health status records
    const { error: deleteError } = await supabase
      .from('health_status')
      .delete()
      .neq('id', 0); // Delete all rows
    
    if (deleteError) {
      logger.error(`Error deleting health status: ${deleteError.message}`);
      return false;
    }
    
    // Then, insert the new health status
    const { error: insertError } = await supabase
      .from('health_status')
      .insert([
        {
          id: 1, // Use a fixed ID for the health status
          ...health,
        },
      ]);
    
    if (insertError) {
      logger.error(`Error inserting health status: ${insertError.message}`);
      return false;
    }
    
    logger.info('Updated health status in Supabase');
    return true;
    
  } catch (error) {
    logger.error(`Error updating health status in Supabase: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Load health status from Supabase
 * 
 * @returns Health status, or null if an error occurred
 */
export async function loadHealthStatusFromSupabase(): Promise<HealthStatus | null> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('health_status')
      .select('*')
      .eq('id', 1)
      .single();
    
    if (error) {
      logger.error(`Error loading health status: ${error.message}`);
      return null;
    }
    
    logger.info('Loaded health status from Supabase');
    return data as HealthStatus;
    
  } catch (error) {
    logger.error(`Error loading health status from Supabase: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Check if Supabase connection is working
 * 
 * @returns True if connection is working, false otherwise
 */
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    
    // Try to query the health_status table
    const { error } = await supabase
      .from('health_status')
      .select('id')
      .limit(1);
    
    if (error) {
      logger.error(`Error checking Supabase connection: ${error.message}`);
      return false;
    }
    
    logger.info('Supabase connection is working');
    return true;
    
  } catch (error) {
    logger.error(`Error checking Supabase connection: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

export default {
  getSupabaseClient,
  saveSubscribersToSupabase,
  loadSubscribersFromSupabase,
  updateHealthStatusInSupabase,
  loadHealthStatusFromSupabase,
  checkSupabaseConnection,
}; 
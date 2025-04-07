/**
 * Batch Monitoring Service
 * 
 * Monitors running batch jobs and saves their results when they complete.
 * This ensures that we don't lose batch results if the application restarts
 * or if a batch takes longer than expected to complete.
 */

import { getChildLogger } from '../utils/logger';
import { getSupabaseClient } from '../../database/supabase-client';
import { settings } from '../config/settings';
import batchProcessor from './batch-processor';
import { batchApiRateLimiter, getExponentialBackoffDelay, sleep } from '../utils/rate-limiter';

// Configure logger
const logger = getChildLogger('batch-monitor');

// Monitoring interval in milliseconds (5 minutes)
const MONITOR_INTERVAL = 0.15 * 60 * 1000;

// Maximum number of consecutive errors before giving up on a batch
const MAX_ERRORS = 3;

// Map to track error counts for each batch
const batchErrorCounts = new Map<string, number>();

// Map to track retry counts for exponential backoff
const batchRetryCount = new Map<string, number>();

// Monitor instance
let monitorInterval: NodeJS.Timeout | null = null;

/**
 * Initialize the batch monitor
 * Finds all running batches and starts monitoring them
 */
export async function initBatchMonitor(): Promise<void> {
  try {
    logger.info('Initializing batch monitor');
    
    // First find all running batches
    const runningBatches = await findRunningBatches();
    
    if (runningBatches.length > 0) {
      logger.info(`Found ${runningBatches.length} running batches to monitor`);
      
      // Log details of running batches
      for (const batch of runningBatches) {
        logger.info(`Monitoring batch ${batch.id} (Anthropic: ${batch.anthropic_batch_id}) - Status: ${batch.status}, Pool: ${batch.pool_type}`);
      }
    } else {
      logger.info('No running batches found');
    }
    
    // Start periodic monitoring
    startMonitoring();
    
    logger.info('Batch monitor initialized');
  } catch (error) {
    logger.error(`Error initializing batch monitor: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Start periodic monitoring of batches
 */
function startMonitoring(): void {
  // Clear any existing monitor
  stopMonitoring();
  
  // Start a new monitor
  monitorInterval = setInterval(async () => {
    try {
      await monitorRunningBatches();
    } catch (error) {
      logger.error(`Error in batch monitor interval: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, MONITOR_INTERVAL);
  
  logger.info(`Batch monitoring started with interval of ${MONITOR_INTERVAL / 1000} seconds`);
}

/**
 * Stop the batch monitor
 */
export function stopMonitoring(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info('Batch monitoring stopped');
  }
}

/**
 * Find all running batches (status 'created' or 'processing')
 */
async function findRunningBatches(): Promise<any[]> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('batch_jobs')
      .select('*')
      .in('status', ['created', 'processing']);
    
    if (error) {
      logger.error(`Error finding running batches: ${error.message}`);
      return [];
    }
    
    return data || [];
  } catch (error) {
    logger.error(`Error finding running batches: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Monitor all running batches
 */
async function monitorRunningBatches(): Promise<void> {
  try {
    // Find all running batches
    const runningBatches = await findRunningBatches();
    
    if (runningBatches.length === 0) {
      return; // No batches to monitor
    }
    
    logger.info(`Monitoring ${runningBatches.length} running batches`);
    
    // Monitor each batch - one at a time with rate limiting
    for (const batch of runningBatches) {
      try {
        // Wait for rate limiter to allow the API call
        await batchApiRateLimiter.waitAndConsume(1);
        
        await monitorBatch(batch);
        
        // Reset retry count on success
        batchRetryCount.delete(batch.id);
      } catch (error) {
        logger.error(`Error monitoring batch ${batch.id}: ${error instanceof Error ? error.message : String(error)}`);
        
        // Increment error count for this batch
        const errorCount = (batchErrorCounts.get(batch.id) || 0) + 1;
        batchErrorCounts.set(batch.id, errorCount);
        
        // Increment retry count for exponential backoff
        const retryCount = (batchRetryCount.get(batch.id) || 0) + 1;
        batchRetryCount.set(batch.id, retryCount);
        
        // If we've had too many errors, mark the batch as failed
        if (errorCount >= MAX_ERRORS) {
          logger.warn(`Giving up on batch ${batch.id} after ${errorCount} consecutive errors`);
          await batchProcessor.updateBatchJobStatus(batch.id, 'failed');
          batchErrorCounts.delete(batch.id);
          batchRetryCount.delete(batch.id);
        }
      }
      
      // Add a small delay between processing different batches
      // Even if rate limited, this helps spread out the load
      await sleep(1000);
    }
  } catch (error) {
    logger.error(`Error monitoring running batches: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Monitor a specific batch
 * @param batch The batch job record
 */
async function monitorBatch(batch: any): Promise<void> {
  try {
    logger.info(`Checking batch ${batch.id} (Anthropic ID: ${batch.anthropic_batch_id})`);
    
    // Create headers for API request
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('x-api-key', settings.CLAUDE_API_KEY || '');
    headers.append('anthropic-version', '2023-06-01');
    
    // Check batch status with Anthropic
    const response = await fetch(`https://api.anthropic.com/v1/messages/batches/${batch.anthropic_batch_id}`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      // Apply exponential backoff for the next retry
      const retryCount = batchRetryCount.get(batch.id) || 0;
      const backoffDelay = getExponentialBackoffDelay(retryCount);
      
      logger.warn(`Failed to check batch status (${response.status} ${response.statusText}). Will retry in ${Math.round(backoffDelay/1000)} seconds.`);
      
      throw new Error(`Failed to check batch status: ${response.status} ${response.statusText}`);
    }
    
    const batchStatus = await response.json();
    
    // If the batch has finished processing
    if (batchStatus.processing_status === 'ended') {
      logger.info(`Batch ${batch.id} has completed processing`);
      
      // Reset error count for this batch
      batchErrorCounts.delete(batch.id);
      batchRetryCount.delete(batch.id);
      
      // If we have a results URL, process the results
      if (batchStatus.results_url) {
        logger.info(`Processing results for batch ${batch.id}`);
        
        // Process results (this function already has rate limiting internally)
        await batchProcessor.processBatchResults(batch.id, batchStatus.results_url, batch.pool_type);
      } else {
        logger.error(`Batch ${batch.id} completed but no results URL available`);
        await batchProcessor.updateBatchJobStatus(batch.id, 'failed');
      }
    } else {
      // Batch is still processing, update status if needed
      if (batch.status === 'created' && batchStatus.processing_status === 'in_progress') {
        logger.info(`Updating batch ${batch.id} status to processing`);
        await batchProcessor.updateBatchJobStatus(batch.id, 'processing');
      }
      
      logger.info(`Batch ${batch.id} is still processing, status: ${batchStatus.processing_status}`);
    }
  } catch (error) {
    logger.error(`Error monitoring batch ${batch.id}: ${error instanceof Error ? error.message : String(error)}`);
    throw error; // Re-throw to increment error count
  }
}

/**
 * Manually check all running batches
 * This can be triggered by an admin command to force an immediate check
 */
export async function forceCheckRunningBatches(): Promise<string> {
  try {
    const runningBatches = await findRunningBatches();
    
    if (runningBatches.length === 0) {
      return "No running batches found to check.";
    }
    
    logger.info(`Manually checking ${runningBatches.length} running batches`);
    
    const results = [];
    
    // Monitor each batch - with rate limiting
    for (const batch of runningBatches) {
      try {
        // Wait for rate limiter to allow the API call
        await batchApiRateLimiter.waitAndConsume(1);
        
        await monitorBatch(batch);
        results.push(`✅ Batch ${batch.id} checked successfully`);
        
        // Add a small delay between batches
        await sleep(1000);
      } catch (error) {
        results.push(`❌ Batch ${batch.id} check failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Return a summary of results
    return `Checked ${runningBatches.length} batches:\n${results.join('\n')}`;
  } catch (error) {
    logger.error(`Error in manual batch check: ${error instanceof Error ? error.message : String(error)}`);
    return `Error checking batches: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export default {
  initBatchMonitor,
  stopMonitoring,
  forceCheckRunningBatches
}; 
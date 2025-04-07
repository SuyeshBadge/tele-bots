/**
 * Rate Limiter Utility
 * 
 * Implements token bucket algorithm for rate limiting API calls.
 * This helps prevent hitting API rate limits and throttling.
 */

import { getChildLogger } from './logger';

const logger = getChildLogger('rate-limiter');

/**
 * Token bucket rate limiter
 */
export class TokenBucketRateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second
  private lastRefillTimestamp: number;
  private readonly name: string;

  /**
   * Create a new token bucket rate limiter
   * @param maxTokens Maximum number of tokens the bucket can hold
   * @param refillRate Rate at which tokens are added to the bucket (tokens per second)
   * @param name Name of this rate limiter for logging
   */
  constructor(maxTokens: number, refillRate: number, name: string = 'default') {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens; // Start with a full bucket
    this.refillRate = refillRate;
    this.lastRefillTimestamp = Date.now();
    this.name = name;
    
    logger.info(`Created rate limiter "${name}" with max ${maxTokens} tokens and refill rate of ${refillRate}/sec`);
  }

  /**
   * Refill the token bucket based on elapsed time
   * @private
   */
  private refill(): void {
    const now = Date.now();
    const elapsedTimeInSeconds = (now - this.lastRefillTimestamp) / 1000;
    
    // Calculate tokens to add based on time elapsed
    const tokensToAdd = elapsedTimeInSeconds * this.refillRate;
    
    // Add tokens up to max capacity
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    
    // Update last refill timestamp
    this.lastRefillTimestamp = now;
  }

  /**
   * Try to consume tokens from the bucket
   * @param tokens Number of tokens to consume (default: 1)
   * @returns true if tokens were consumed, false otherwise
   */
  public tryConsume(tokens: number = 1): boolean {
    // First refill the bucket based on elapsed time
    this.refill();
    
    // Check if there are enough tokens
    if (this.tokens < tokens) {
      logger.debug(`Rate limit hit for "${this.name}" - requested ${tokens} tokens but only have ${this.tokens.toFixed(2)}`);
      return false;
    }
    
    // Consume tokens
    this.tokens -= tokens;
    return true;
  }

  /**
   * Wait until tokens are available and then consume them
   * @param tokens Number of tokens to consume (default: 1)
   * @param maxWaitMs Maximum time to wait in milliseconds (default: 30000)
   * @returns Promise that resolves when tokens are consumed, or rejects if max wait time is exceeded
   */
  public async waitAndConsume(tokens: number = 1, maxWaitMs: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (true) {
      // First try to consume
      if (this.tryConsume(tokens)) {
        return;
      }
      
      // Calculate how long we've been waiting
      const elapsedMs = Date.now() - startTime;
      
      // Check if we've exceeded max wait time
      if (elapsedMs >= maxWaitMs) {
        const error = new Error(`Rate limit wait timeout after ${elapsedMs}ms for "${this.name}"`);
        logger.warn(error.message);
        throw error;
      }
      
      // Calculate how long to wait before the next check
      // We need at least 'tokens' tokens, we currently have this.tokens
      // At refillRate tokens/sec, we need to wait this long:
      const tokensNeeded = tokens - this.tokens;
      const waitTimeMs = tokensNeeded > 0 
        ? Math.ceil((tokensNeeded / this.refillRate) * 1000)
        : 100; // Minimum wait time
      
      // Cap the wait time to avoid waiting too long
      const waitTime = Math.min(waitTimeMs, 1000, maxWaitMs - elapsedMs);
      
      // Wait before trying again
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Create and export rate limiters for various APIs
// Anthropic's rate limits are documented at 5 requests per minute (effectively 1 every 12 seconds)
export const anthropicRateLimiter = new TokenBucketRateLimiter(5, 1/12, 'anthropic-api');

// More conservative batch API rate limiter (1 request per 15 seconds)
export const batchApiRateLimiter = new TokenBucketRateLimiter(4, 1/15, 'anthropic-batch-api');

// Generic API rate limiter for external services (10 requests per minute)
export const genericApiRateLimiter = new TokenBucketRateLimiter(10, 1/6, 'generic-api');

// Exponential backoff utility
/**
 * Calculate delay for exponential backoff
 * @param retry Retry count (0-based)
 * @param baseDelayMs Base delay in milliseconds
 * @param maxDelayMs Maximum delay in milliseconds
 * @param jitter Whether to add jitter (randomness) to the delay
 * @returns Delay in milliseconds
 */
export function getExponentialBackoffDelay(
  retry: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 60000,
  jitter: boolean = true
): number {
  // Calculate exponential backoff: baseDelay * 2^retry
  const exponentialDelay = baseDelayMs * Math.pow(2, retry);
  
  // Apply maximum delay cap
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  
  // Apply jitter if enabled (adds or subtracts up to 20% randomly)
  if (jitter) {
    const jitterFactor = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
    return Math.floor(cappedDelay * jitterFactor);
  }
  
  return Math.floor(cappedDelay);
}

/**
 * Sleep for a specified duration
 * @param ms Milliseconds to sleep
 * @returns Promise that resolves after the specified time
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export default for convenience
export default {
  TokenBucketRateLimiter,
  anthropicRateLimiter,
  batchApiRateLimiter,
  genericApiRateLimiter,
  getExponentialBackoffDelay,
  sleep
}; 
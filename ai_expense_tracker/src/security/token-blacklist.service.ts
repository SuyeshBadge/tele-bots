import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private readonly blacklistedTokens: Map<string, number> = new Map(); // jti -> expiry timestamp
  
  // Clean up interval in milliseconds (runs every hour)
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000;
  
  constructor() {
    // Schedule cleanup of expired tokens
    setInterval(() => this.cleanupExpiredTokens(), this.CLEANUP_INTERVAL);
  }
  
  /**
   * Adds a token to the blacklist
   * @param jti JWT ID to blacklist
   * @param expiryTimestamp Unix timestamp when the token expires
   */
  blacklistToken(jti: string, expiryTimestamp: number): void {
    this.blacklistedTokens.set(jti, expiryTimestamp);
    this.logger.log(`Token blacklisted: ${jti}`);
  }
  
  /**
   * Checks if a token is blacklisted
   * @param jti JWT ID to check
   * @returns boolean indicating if token is blacklisted
   */
  isBlacklisted(jti: string): boolean {
    return this.blacklistedTokens.has(jti);
  }
  
  /**
   * Removes expired tokens from the blacklist
   */
  private cleanupExpiredTokens(): void {
    const now = Math.floor(Date.now() / 1000);
    let cleanupCount = 0;
    
    for (const [jti, expiry] of this.blacklistedTokens.entries()) {
      if (expiry <= now) {
        this.blacklistedTokens.delete(jti);
        cleanupCount++;
      }
    }
    
    if (cleanupCount > 0) {
      this.logger.log(`Cleaned up ${cleanupCount} expired tokens from blacklist`);
    }
  }
} 
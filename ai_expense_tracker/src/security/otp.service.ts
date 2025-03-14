import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly OTP_ATTEMPTS_STORE: Map<string, { attempts: number, lastAttempt: Date }> = new Map();
  private readonly MAX_OTP_ATTEMPTS = 5;
  private readonly OTP_ATTEMPT_WINDOW_MINUTES = 30;

  generateOtp(): string {
    // Generate a cryptographically secure OTP rather than using Math.random()
    return crypto.randomInt(100000, 999999).toString();
  }

  registerAttempt(identifier: string): boolean {
    // Get current attempts or initialize new record
    const now = new Date();
    const current = this.OTP_ATTEMPTS_STORE.get(identifier) || { attempts: 0, lastAttempt: now };
    
    // Check if we should reset the counter (if outside the attempt window)
    const timeDiffMinutes = Math.floor((now.getTime() - current.lastAttempt.getTime()) / (1000 * 60));
    
    if (timeDiffMinutes > this.OTP_ATTEMPT_WINDOW_MINUTES) {
      // Reset counter after window expires
      this.OTP_ATTEMPTS_STORE.set(identifier, { attempts: 1, lastAttempt: now });
      return true;
    }
    
    // Increment attempts
    const newAttempts = current.attempts + 1;
    
    // Check if we've exceeded max attempts
    if (newAttempts > this.MAX_OTP_ATTEMPTS) {
      this.logger.warn(`Maximum OTP verification attempts exceeded for ${identifier}`);
      return false;
    }
    
    // Update the store
    this.OTP_ATTEMPTS_STORE.set(identifier, { attempts: newAttempts, lastAttempt: now });
    return true;
  }

  resetAttempts(identifier: string): void {
    this.OTP_ATTEMPTS_STORE.delete(identifier);
  }
} 
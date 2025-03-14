import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class OtpThrottleGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): string {
    // Use both IP and mobile number to track OTP requests
    const ip = req.ip;
    const mobileNumber = req.body?.mobileNumber || 'unknown';
    
    return `${ip}-${mobileNumber}`;
  }
  
  protected getTrackerCustomKey(): string {
    return 'otp-throttle';
  }
} 
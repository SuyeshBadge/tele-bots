import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { OtpService } from './otp.service';
import { OtpThrottleGuard } from './otp-throttle.guard';
import { TokenBlacklistService } from './token-blacklist.service';
import { JwtConfigService } from './jwt-config.service';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60, // time in seconds
      limit: 10, // number of requests per TTL
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    OtpService,
    OtpThrottleGuard,
    TokenBlacklistService,
    JwtConfigService,
  ],
  exports: [
    OtpService, 
    OtpThrottleGuard, 
    TokenBlacklistService, 
    JwtConfigService
  ],
})
export class SecurityModule {} 
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions, JwtOptionsFactory } from '@nestjs/jwt';

@Injectable()
export class JwtConfigService implements JwtOptionsFactory {
  constructor(private configService: ConfigService) {}

  createJwtOptions(): JwtModuleOptions {
    return {
      secret: this.configService.get<string>('JWT_SECRET'),
      signOptions: {
        expiresIn: '1h', // Shorter expiry time for better security
        issuer: 'expense-tracker-api',
        audience: 'expense-tracker-clients',
        notBefore: '0', // Token valid immediately
      },
      verifyOptions: {
        issuer: 'expense-tracker-api',
        audience: 'expense-tracker-clients',
      }
    };
  }
} 
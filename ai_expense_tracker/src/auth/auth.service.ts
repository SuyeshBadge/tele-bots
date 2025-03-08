import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(userId: string): Promise<any> {
    // This would normally validate a user from the database
    return { userId };
  }

  async login(userId: string, clientType: 'telegram' | 'app' | 'web') {
    const payload = { 
      sub: userId, 
      clientType 
    };
    
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        userId,
      }
    };
  }
  
  async generateTelegramToken(telegramId: string): Promise<string> {
    // For Telegram Bot users, we generate a special token
    const payload = { 
      sub: telegramId, 
      clientType: 'telegram' 
    };
    
    return this.jwtService.sign(payload);
  }
} 
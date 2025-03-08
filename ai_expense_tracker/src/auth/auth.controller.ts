import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../decorators/public.decorator';

@Controller('api/auth')
export class AuthController {
  @Public()
  @Post('login')
  async login(@Body() loginDto: { userId: string; clientType: 'app' | 'web' }) {
    return { message: 'Login endpoint', userId: loginDto.userId, clientType: loginDto.clientType };
  }

  @Public()
  @Post('register')
  async register(
    @Body() 
    registerDto: { 
      telegramId: string; 
      firstName?: string; 
      lastName?: string; 
      username?: string;
      clientType: 'app' | 'web' 
    }
  ) {
    return { message: 'Register endpoint', user: registerDto };
  }
} 
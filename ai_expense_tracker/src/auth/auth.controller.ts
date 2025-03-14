import { Body, Controller, Post, HttpCode, HttpStatus, UseGuards, Req, Get } from '@nestjs/common';
import { Public } from '../decorators/public.decorator';
import { AuthService } from './auth.service';
import { SendOtpDto, VerifyOtpDto } from './dto/mobile-auth.dto';
import { OtpThrottleGuard } from '../security/otp-throttle.guard';
import { Request } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBody, 
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam
} from '@nestjs/swagger';
import { 
  SendOtpResponse, 
  VerifyOtpResponse, 
  LogoutResponse,
  ApiResponse as ApiResponseType
} from '../swagger/swagger.schema';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with user ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', example: 'user123' },
        clientType: { type: 'string', enum: ['app', 'web'], example: 'app' }
      },
      required: ['userId', 'clientType']
    }
  })
  @ApiOkResponse({ description: 'Successfully logged in' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(@Body() loginDto: { userId: string; clientType: 'app' | 'web' }) {
    return { message: 'Login endpoint', userId: loginDto.userId, clientType: loginDto.clientType };
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        telegramId: { type: 'string', example: 'telegram123' },
        firstName: { type: 'string', example: 'John' },
        lastName: { type: 'string', example: 'Doe' },
        username: { type: 'string', example: 'johndoe' },
        clientType: { type: 'string', enum: ['app', 'web'], example: 'app' }
      },
      required: ['telegramId', 'clientType']
    }
  })
  @ApiCreatedResponse({ description: 'User successfully registered' })
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

  @Public()
  @UseGuards(OtpThrottleGuard)
  @Post('mobile/send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP to mobile number' })
  @ApiBody({ type: SendOtpDto })
  @ApiOkResponse({ 
    description: 'OTP sent successfully',
    type: ApiResponseType,
    schema: {
      properties: {
        data: { $ref: '#/components/schemas/SendOtpResponse' },
        meta: { $ref: '#/components/schemas/ApiResponseMeta' }
      }
    }
  })
  @ApiTooManyRequestsResponse({ description: 'Too many requests, please try again later' })
  async sendOtp(@Body() sendOtpDto: SendOtpDto, @Req() request: Request): Promise<SendOtpResponse> {
    // Pass IP address for logging and security tracking
    const clientIp = request.ip;
    return this.authService.sendOtp(sendOtpDto.mobileNumber, clientIp);
  }

  @Public()
  @UseGuards(OtpThrottleGuard)
  @Post('mobile/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and get access token' })
  @ApiBody({ type: VerifyOtpDto })
  @ApiOkResponse({ 
    description: 'OTP verified successfully',
    type: ApiResponseType,
    schema: {
      properties: {
        data: { $ref: '#/components/schemas/VerifyOtpResponse' },
        meta: { $ref: '#/components/schemas/ApiResponseMeta' }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Invalid OTP or OTP expired' })
  @ApiTooManyRequestsResponse({ description: 'Too many verification attempts' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto, @Req() request: Request): Promise<VerifyOtpResponse> {
    // Pass IP address for logging and security tracking
    const clientIp = request.ip;
    return this.authService.verifyOtp(
      verifyOtpDto.mobileNumber,
      verifyOtpDto.otpCode,
      clientIp
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate token' })
  @ApiOkResponse({ 
    description: 'Successfully logged out',
    type: ApiResponseType,
    schema: {
      properties: {
        data: { $ref: '#/components/schemas/LogoutResponse' },
        meta: { $ref: '#/components/schemas/ApiResponseMeta' }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token' })
  async logout(@Req() request: Request): Promise<LogoutResponse> {
    const token = this.extractTokenFromHeader(request);
    return this.authService.logout(token);
  }

  @Public()
  @Get('csrf-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get CSRF token for web clients' })
  @ApiOkResponse({ 
    description: 'CSRF token generated successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            csrfToken: { type: 'string', example: 'abc123xyz456' }
          }
        },
        meta: { $ref: '#/components/schemas/ApiResponseMeta' }
      }
    }
  })
  getCsrfToken(@Req() request: Request) {
    // The csrfToken function is added by the csurf middleware
    // This is a type assertion to handle the fact that Express types don't include it
    const csrfToken = (request as any).csrfToken?.();
    return { csrfToken };
  }

  private extractTokenFromHeader(request: Request): string {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }
} 
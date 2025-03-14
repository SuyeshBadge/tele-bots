import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseMeta {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2023-03-14T10:20:30.123Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Request path',
    example: '/api/auth/mobile/send-otp',
  })
  path: string;
}

export class ApiResponse<T> {
  @ApiProperty()
  data: T;

  @ApiProperty({
    type: ApiResponseMeta,
  })
  meta: ApiResponseMeta;
}

// Specific response types for mobile OTP APIs
export class SendOtpResponse {
  @ApiProperty({
    description: 'Success message',
    example: 'OTP sent successfully',
  })
  message: string;

  @ApiProperty({
    description: 'OTP expiry time in minutes',
    example: 10,
  })
  expiresIn: number;

  @ApiProperty({
    description: 'OTP code (only in development mode)',
    example: '123456',
    required: false,
  })
  otp?: string;
}

export class VerifyOtpUserResponse {
  @ApiProperty({
    description: 'User ID',
    example: '60c72b2f8e1b9a001c8e8c01',
  })
  id: string;

  @ApiProperty({
    description: 'User\'s Telegram ID',
    example: 'm_1623456789123',
  })
  telegramId: string;

  @ApiProperty({
    description: 'User\'s mobile number',
    example: '1234567890',
  })
  mobileNumber: string;

  @ApiProperty({
    description: 'User\'s first name',
    example: 'John',
    required: false,
    nullable: true,
  })
  firstName: string | null;

  @ApiProperty({
    description: 'User\'s last name',
    example: 'Doe',
    required: false,
    nullable: true,
  })
  lastName: string | null;

  @ApiProperty({
    description: 'Whether the user has completed onboarding',
    example: false,
  })
  isOnboarded: boolean;
}

export class VerifyOtpResponse {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    type: VerifyOtpUserResponse,
  })
  user: VerifyOtpUserResponse;
}

export class LogoutResponse {
  @ApiProperty({
    description: 'Success message',
    example: 'Successfully logged out',
  })
  message: string;
} 
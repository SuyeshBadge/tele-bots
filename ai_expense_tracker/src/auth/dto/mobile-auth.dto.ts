import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({
    description: 'Mobile number to send OTP to',
    example: '1234567890',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Mobile number is required' })
  @Matches(/^[0-9]{10}$/, { message: 'Mobile number must be 10 digits' })
  mobileNumber: string;
}

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Mobile number to verify OTP for',
    example: '1234567890',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Mobile number is required' })
  @Matches(/^[0-9]{10}$/, { message: 'Mobile number must be 10 digits' })
  mobileNumber: string;

  @ApiProperty({
    description: '6-digit OTP code received via SMS',
    example: '123456',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'OTP is required' })
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  otpCode: string;
} 
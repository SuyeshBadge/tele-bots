import { IsString, IsEmail, IsBoolean, IsOptional, Length, IsObject, ValidateNested, IsNumber, Min, IsNotEmpty } from 'class-validator';
import { BaseDto } from './base.dto';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BudgetCategoryDto {
  @ApiProperty({
    description: 'Category name for the budget',
    example: 'food',
    minLength: 1,
    maxLength: 50
  })
  @IsString()
  @Length(1, 50)
  category: string;

  @ApiProperty({
    description: 'Budget amount for the category',
    example: 500,
    minimum: 0
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;
}

export class UserPreferencesDto {
  @ApiProperty({
    description: 'Whether user wants to receive notifications',
    example: true
  })
  @IsBoolean()
  notificationsEnabled: boolean;

  @ApiPropertyOptional({
    description: 'Time of day for reminders (HH:MM format)',
    example: '20:00',
    pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$'
  })
  @IsOptional()
  @IsString()
  @Length(5, 5) // Format: HH:MM
  reminderTime?: string;

  @ApiPropertyOptional({
    description: 'Monthly budget limit',
    example: 5000,
    minimum: 0
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyBudget?: number;

  @ApiPropertyOptional({
    description: 'Budget categories with their respective limits',
    type: Object,
    example: { food: 1000, transport: 500 }
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BudgetCategoryDto)
  budgetCategories?: Record<string, number>;

  @ApiPropertyOptional({
    description: 'User\'s timezone',
    example: 'Asia/Kolkata'
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class CreateUserDto extends BaseDto {
  @ApiProperty({
    description: 'User\'s full name',
    example: 'John Doe',
    minLength: 3,
    maxLength: 50
  })
  @IsString()
  @Length(3, 50, { message: 'Name must be between 3 and 50 characters' })
  name: string;

  @ApiProperty({
    description: 'User\'s email address',
    example: 'john.doe@example.com'
  })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({
    description: 'User\'s password',
    example: 'StrongPassword123',
    minLength: 8,
    maxLength: 100,
    format: 'password'
  })
  @IsString()
  @Length(8, 100, { message: 'Password must be at least 8 characters' })
  password: string;

  @ApiPropertyOptional({
    description: 'User preferences',
    type: UserPreferencesDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UserPreferencesDto)
  preferences?: UserPreferencesDto;
}

export class UpdateUserDto extends BaseDto {
  @ApiPropertyOptional({
    description: 'User\'s full name',
    example: 'John Doe',
    minLength: 3,
    maxLength: 50
  })
  @IsOptional()
  @IsString()
  @Length(3, 50, { message: 'Name must be between 3 and 50 characters' })
  name?: string;

  @ApiPropertyOptional({
    description: 'User\'s email address',
    example: 'john.doe@example.com'
  })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @ApiPropertyOptional({
    description: 'User\'s current password (required for password change)',
    example: 'CurrentPassword123',
    minLength: 8,
    maxLength: 100,
    format: 'password'
  })
  @IsOptional()
  @IsString()
  @Length(8, 100, { message: 'Password must be at least 8 characters' })
  currentPassword?: string;

  @ApiPropertyOptional({
    description: 'User\'s new password',
    example: 'NewStrongPassword123',
    minLength: 8,
    maxLength: 100,
    format: 'password'
  })
  @IsOptional()
  @IsString()
  @Length(8, 100, { message: 'New password must be at least 8 characters' })
  newPassword?: string;
}

export class UpdateUserPreferencesDto extends BaseDto {
  @ApiPropertyOptional({
    description: 'Whether user wants to receive notifications',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Time of day for reminders (HH:MM format)',
    example: '20:00',
    pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$'
  })
  @IsOptional()
  @IsString()
  @Length(5, 5) // Format: HH:MM
  reminderTime?: string;

  @ApiPropertyOptional({
    description: 'Monthly budget limit',
    example: 5000,
    minimum: 0
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyBudget?: number;

  @ApiPropertyOptional({
    description: 'Budget categories with their respective limits',
    type: Object,
    example: { food: 1000, transport: 500 }
  })
  @IsOptional()
  @IsObject()
  budgetCategories?: Record<string, number>;

  @ApiPropertyOptional({
    description: 'User\'s timezone',
    example: 'Asia/Kolkata'
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdateOnboardingStatusDto extends BaseDto {
  @ApiProperty({
    description: 'Whether the user has completed onboarding',
    example: true
  })
  @IsNotEmpty()
  @IsBoolean()
  isOnboarded: boolean;
} 
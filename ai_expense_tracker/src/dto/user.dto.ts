import { IsString, IsEmail, IsBoolean, IsOptional, Length, IsObject, ValidateNested, IsNumber, Min, IsNotEmpty } from 'class-validator';
import { BaseDto } from './base.dto';
import { Type } from 'class-transformer';

export class BudgetCategoryDto {
  @IsString()
  @Length(1, 50)
  category: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;
}

export class UserPreferencesDto {
  @IsBoolean()
  notificationsEnabled: boolean;

  @IsOptional()
  @IsString()
  @Length(5, 5) // Format: HH:MM
  reminderTime?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyBudget?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BudgetCategoryDto)
  budgetCategories?: Record<string, number>;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class CreateUserDto extends BaseDto {
  @IsString()
  @Length(3, 50, { message: 'Name must be between 3 and 50 characters' })
  name: string;

  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString()
  @Length(8, 100, { message: 'Password must be at least 8 characters' })
  password: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserPreferencesDto)
  preferences?: UserPreferencesDto;
}

export class UpdateUserDto extends BaseDto {
  @IsOptional()
  @IsString()
  @Length(3, 50, { message: 'Name must be between 3 and 50 characters' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @IsOptional()
  @IsString()
  @Length(8, 100, { message: 'Password must be at least 8 characters' })
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @Length(8, 100, { message: 'New password must be at least 8 characters' })
  newPassword?: string;
}

export class UpdateUserPreferencesDto extends BaseDto {
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Length(5, 5) // Format: HH:MM
  reminderTime?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyBudget?: number;

  @IsOptional()
  @IsObject()
  budgetCategories?: Record<string, number>;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdateOnboardingStatusDto extends BaseDto {
  @IsNotEmpty()
  @IsBoolean()
  isOnboarded: boolean;
} 
import { IsNumber, IsString, IsEnum, IsOptional, IsBoolean, IsDate, Min, Length } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseDto } from './base.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncomeCategory } from '../models/income.model';

export class CreateIncomeDto extends BaseDto {
  @ApiProperty({
    description: 'Amount of the income',
    example: 5000,
    minimum: 0
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Amount must be greater than or equal to 0' })
  amount: number;

  @ApiProperty({
    description: 'Category of the income',
    enum: IncomeCategory,
    example: 'salary'
  })
  @IsEnum(IncomeCategory, { message: 'Invalid income category' })
  category: IncomeCategory;

  @ApiPropertyOptional({
    description: 'Description of the income',
    example: 'Monthly salary',
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @Length(0, 100, { message: 'Description must be less than 100 characters' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Date of the income receipt',
    example: '2023-03-01T00:00:00Z',
    type: Date
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  date?: Date;

  @ApiPropertyOptional({
    description: 'Whether this income is recurring',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    description: 'Frequency of recurring income (daily, weekly, monthly, etc.)',
    example: 'monthly',
    maxLength: 20
  })
  @IsOptional()
  @IsString()
  @Length(0, 20, { message: 'Frequency must be less than 20 characters' })
  recurringFrequency?: string;

  @ApiPropertyOptional({
    description: 'Source of the income',
    example: 'Employer Inc.',
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @Length(0, 100, { message: 'Source must be less than 100 characters' })
  source?: string;
}

export class UpdateIncomeDto extends BaseDto {
  @ApiPropertyOptional({
    description: 'Amount of the income',
    example: 5000,
    minimum: 0
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Amount must be greater than or equal to 0' })
  amount?: number;

  @ApiPropertyOptional({
    description: 'Category of the income',
    enum: IncomeCategory,
    example: 'salary'
  })
  @IsOptional()
  @IsEnum(IncomeCategory, { message: 'Invalid income category' })
  category?: IncomeCategory;

  @ApiPropertyOptional({
    description: 'Description of the income',
    example: 'Monthly salary',
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @Length(0, 100, { message: 'Description must be less than 100 characters' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Date of the income receipt',
    example: '2023-03-01T00:00:00Z',
    type: Date
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  date?: Date;

  @ApiPropertyOptional({
    description: 'Whether this income is recurring',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    description: 'Frequency of recurring income (daily, weekly, monthly, etc.)',
    example: 'monthly',
    maxLength: 20
  })
  @IsOptional()
  @IsString()
  @Length(0, 20, { message: 'Frequency must be less than 20 characters' })
  recurringFrequency?: string;

  @ApiPropertyOptional({
    description: 'Source of the income',
    example: 'Employer Inc.',
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @Length(0, 100, { message: 'Source must be less than 100 characters' })
  source?: string;
}

export class IncomeFilterDto extends BaseDto {
  @ApiPropertyOptional({
    description: 'Filter incomes from this date',
    example: '2023-01-01T00:00:00Z',
    type: Date
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'Filter incomes until this date',
    example: '2023-12-31T23:59:59Z',
    type: Date
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Filter by income category',
    enum: IncomeCategory,
    example: 'salary'
  })
  @IsOptional()
  @IsEnum(IncomeCategory, { message: 'Invalid income category' })
  category?: IncomeCategory;

  @ApiPropertyOptional({
    description: 'Minimum amount for filtering incomes',
    example: 1000,
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional({
    description: 'Maximum amount for filtering incomes',
    example: 10000
  })
  @IsOptional()
  @IsNumber()
  maxAmount?: number;

  @ApiPropertyOptional({
    description: 'Search term to filter incomes by description or source',
    example: 'salary',
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  searchTerm?: string;
} 
import { IsString, IsNumber, IsDate, IsEnum, IsOptional, Min, Max, Length, IsArray, ArrayMinSize, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseDto } from './base.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ExpenseCategory {
  FOOD = 'food',
  TRANSPORT = 'transport',
  ENTERTAINMENT = 'entertainment',
  UTILITIES = 'utilities',
  RENT = 'rent',
  SHOPPING = 'shopping',
  HEALTHCARE = 'healthcare',
  EDUCATION = 'education',
  TRAVEL = 'travel',
  OTHER = 'other',
}

export class TagDto {
  @ApiProperty({
    description: 'Name of the tag',
    example: 'Lunch',
    minLength: 1,
    maxLength: 50
  })
  @IsString()
  @Length(1, 50)
  name: string;

  @ApiPropertyOptional({
    description: 'Optional description for the tag',
    example: 'Expenses related to lunch',
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  description?: string;
}

export class CreateExpenseDto extends BaseDto {
  @ApiProperty({
    description: 'Amount of the expense',
    example: 42.50,
    minimum: 0,
    maximum: 1000000
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Amount must be greater than or equal to 0' })
  @Max(1000000, { message: 'Amount must be less than or equal to 1,000,000' })
  amount: number;

  @ApiProperty({
    description: 'Description of the expense',
    example: 'Lunch at restaurant',
    minLength: 3,
    maxLength: 100
  })
  @IsString()
  @Length(3, 100, { message: 'Description must be between 3 and 100 characters' })
  description: string;

  @ApiProperty({
    description: 'Date of the expense',
    example: '2023-03-14T12:00:00Z',
    type: Date
  })
  @IsDate()
  @Type(() => Date)
  date: Date;

  @ApiProperty({
    description: 'Category of the expense',
    enum: ExpenseCategory,
    example: ExpenseCategory.FOOD
  })
  @IsEnum(ExpenseCategory, { message: 'Invalid expense category' })
  category: ExpenseCategory;

  @ApiPropertyOptional({
    description: 'Tags associated with the expense',
    type: [TagDto],
    example: [{ name: 'Lunch', description: 'Weekday lunch' }],
    maxItems: 10
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(10, { message: 'Maximum 10 tags allowed' })
  @ValidateNested({ each: true })
  @Type(() => TagDto)
  tags?: TagDto[];

  @ApiPropertyOptional({
    description: 'Additional notes about the expense',
    example: 'Business lunch with client',
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class UpdateExpenseDto extends BaseDto {
  @ApiPropertyOptional({
    description: 'Amount of the expense',
    example: 42.50,
    minimum: 0,
    maximum: 1000000
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Amount must be greater than or equal to 0' })
  @Max(1000000, { message: 'Amount must be less than or equal to 1,000,000' })
  amount?: number;

  @ApiPropertyOptional({
    description: 'Description of the expense',
    example: 'Lunch at restaurant',
    minLength: 3,
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @Length(3, 100, { message: 'Description must be between 3 and 100 characters' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Date of the expense',
    example: '2023-03-14T12:00:00Z',
    type: Date
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  date?: Date;

  @ApiPropertyOptional({
    description: 'Category of the expense',
    enum: ExpenseCategory,
    example: ExpenseCategory.FOOD
  })
  @IsOptional()
  @IsEnum(ExpenseCategory, { message: 'Invalid expense category' })
  category?: ExpenseCategory;

  @ApiPropertyOptional({
    description: 'Tags associated with the expense',
    type: [TagDto],
    example: [{ name: 'Lunch', description: 'Weekday lunch' }],
    maxItems: 10
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(10, { message: 'Maximum 10 tags allowed' })
  @ValidateNested({ each: true })
  @Type(() => TagDto)
  tags?: TagDto[];

  @ApiPropertyOptional({
    description: 'Additional notes about the expense',
    example: 'Business lunch with client',
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class ExpenseFilterDto extends BaseDto {
  @ApiPropertyOptional({
    description: 'Filter expenses from this date',
    example: '2023-01-01T00:00:00Z',
    type: Date
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'Filter expenses until this date',
    example: '2023-12-31T23:59:59Z',
    type: Date
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Filter by expense category',
    enum: ExpenseCategory,
    example: ExpenseCategory.FOOD
  })
  @IsOptional()
  @IsEnum(ExpenseCategory, { message: 'Invalid expense category' })
  category?: ExpenseCategory;

  @ApiPropertyOptional({
    description: 'Minimum amount for filtering expenses',
    example: 10,
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional({
    description: 'Maximum amount for filtering expenses',
    example: 1000,
    maximum: 1000000
  })
  @IsOptional()
  @IsNumber()
  @Max(1000000)
  maxAmount?: number;

  @ApiPropertyOptional({
    description: 'Search term to filter expenses by description',
    example: 'lunch',
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  searchTerm?: string;
} 
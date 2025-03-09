import { IsString, IsNumber, IsDate, IsEnum, IsOptional, Min, Max, Length, IsArray, ArrayMinSize, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseDto } from './base.dto';

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
  @IsString()
  @Length(1, 50)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  description?: string;
}

export class CreateExpenseDto extends BaseDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Amount must be greater than or equal to 0' })
  @Max(1000000, { message: 'Amount must be less than or equal to 1,000,000' })
  amount: number;

  @IsString()
  @Length(3, 100, { message: 'Description must be between 3 and 100 characters' })
  description: string;

  @IsDate()
  @Type(() => Date)
  date: Date;

  @IsEnum(ExpenseCategory, { message: 'Invalid expense category' })
  category: ExpenseCategory;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(10, { message: 'Maximum 10 tags allowed' })
  @ValidateNested({ each: true })
  @Type(() => TagDto)
  tags?: TagDto[];

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class UpdateExpenseDto extends BaseDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Amount must be greater than or equal to 0' })
  @Max(1000000, { message: 'Amount must be less than or equal to 1,000,000' })
  amount?: number;

  @IsOptional()
  @IsString()
  @Length(3, 100, { message: 'Description must be between 3 and 100 characters' })
  description?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  date?: Date;

  @IsOptional()
  @IsEnum(ExpenseCategory, { message: 'Invalid expense category' })
  category?: ExpenseCategory;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(10, { message: 'Maximum 10 tags allowed' })
  @ValidateNested({ each: true })
  @Type(() => TagDto)
  tags?: TagDto[];

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class ExpenseFilterDto extends BaseDto {
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @IsOptional()
  @IsEnum(ExpenseCategory, { message: 'Invalid expense category' })
  category?: ExpenseCategory;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @IsNumber()
  @Max(1000000)
  maxAmount?: number;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  searchTerm?: string;
} 
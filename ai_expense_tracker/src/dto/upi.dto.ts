import { IsNumber, IsString, IsOptional, IsDate, Min, Length } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseDto } from './base.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUpiTransactionDto extends BaseDto {
  @ApiProperty({
    description: 'Amount of the UPI transaction',
    example: 299.50,
    minimum: 0
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Amount must be greater than or equal to 0' })
  amount: number;

  @ApiProperty({
    description: 'Name of the merchant or recipient',
    example: 'Zomato',
    maxLength: 100
  })
  @IsString()
  @Length(1, 100, { message: 'Merchant name must be between 1 and 100 characters' })
  merchantName: string;

  @ApiPropertyOptional({
    description: 'UPI ID of the merchant (e.g., merchant@upi)',
    example: 'zomato@upi',
    maxLength: 50
  })
  @IsOptional()
  @IsString()
  @Length(0, 50, { message: 'UPI ID must be less than 50 characters' })
  upiId?: string;

  @ApiPropertyOptional({
    description: 'Date of the transaction',
    example: '2023-03-14T12:00:00Z',
    type: Date
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  date?: Date;
}

export class UpiTransactionResponseDto extends BaseDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: 'upi-123456-abcdef'
  })
  transactionId: string;

  @ApiProperty({
    description: 'Amount of the transaction',
    example: 299.50
  })
  amount: number;

  @ApiProperty({
    description: 'Name of the merchant or recipient',
    example: 'Zomato'
  })
  merchantName: string;

  @ApiProperty({
    description: 'UPI ID of the merchant',
    example: 'zomato@upi'
  })
  upiId: string;

  @ApiProperty({
    description: 'Status of the transaction',
    example: 'SUCCESS',
    enum: ['SUCCESS', 'PENDING', 'FAILED']
  })
  status: 'SUCCESS' | 'PENDING' | 'FAILED';

  @ApiProperty({
    description: 'Date and time of the transaction',
    example: '2023-03-14T12:00:00Z',
    type: Date
  })
  date: Date;

  @ApiPropertyOptional({
    description: 'Category inferred from merchant name',
    example: 'food'
  })
  category?: string;

  @ApiPropertyOptional({
    description: 'Transaction reference number',
    example: 'REF123456789'
  })
  reference?: string;
} 
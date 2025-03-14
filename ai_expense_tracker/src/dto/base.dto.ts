import { IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Base DTO class that implements common validation rules
 * All other DTOs should extend this class
 */
export class BaseDto {
  @ApiPropertyOptional({
    description: 'Unique identifier (UUID v4)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid'
  })
  @IsOptional()
  @IsUUID(4, { message: 'Invalid UUID format' })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  id?: string;

  @ApiPropertyOptional({
    description: 'Whether to include deleted records',
    example: false,
    default: false
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Convert string 'true'/'false' to boolean
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  includeDeleted?: boolean;

  /**
   * Validation helper method that can be called before saving data
   * This method can be overridden in child classes to add custom validation logic
   */
  validate(): void {
    // Base validation logic can be added here
    // Child classes can extend this method
  }
} 
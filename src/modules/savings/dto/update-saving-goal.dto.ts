import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString, Min, Matches } from 'class-validator';

export class UpdateSavingGoalDto {
  @ApiPropertyOptional({ example: 'Updated Laptop Fund', description: 'Name of the savings target goal' })
  @IsOptional()
  @IsString()
  goalName?: string;

  @ApiPropertyOptional({ example: 100000, description: 'Target financial amount to reach' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  targetAmount?: number;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Target date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Target date must be formatted as YYYY-MM-DD' })
  targetDate?: string;
}

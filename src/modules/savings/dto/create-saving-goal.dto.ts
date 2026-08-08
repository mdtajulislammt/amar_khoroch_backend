import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsOptional, Min, Matches } from 'class-validator';

export class CreateSavingGoalDto {
  @ApiProperty({ example: 'New Laptop Fund', description: 'Name of the savings target goal' })
  @IsString()
  @IsNotEmpty({ message: 'Goal name is required' })
  goalName: string;

  @ApiProperty({ example: 90000, description: 'Target financial amount to reach' })
  @IsNumber({}, { message: 'Target amount must be a number' })
  @Min(1, { message: 'Target amount must be greater than 0' })
  targetAmount: number;

  @ApiPropertyOptional({ example: 0, description: 'Initial current saved amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentAmount?: number = 0;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Target date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Target date must be formatted as YYYY-MM-DD' })
  targetDate?: string;
}

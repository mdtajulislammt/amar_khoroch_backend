import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsEnum, Min } from 'class-validator';
import { BudgetPeriod } from '@prisma/client';

export class CreateBudgetDto {
  @ApiProperty({ example: 'c1', description: 'Category ID to set spending limit on' })
  @IsString()
  @IsNotEmpty({ message: 'Category ID is required' })
  categoryId: string;

  @ApiProperty({ example: 6000, description: 'Maximum spending limit amount' })
  @IsNumber({}, { message: 'Limit amount must be a number' })
  @Min(1, { message: 'Limit amount must be greater than 0' })
  limitAmount: number;

  @ApiProperty({ example: 'MONTHLY', enum: BudgetPeriod, description: 'Budget period (MONTHLY or WEEKLY)' })
  @IsEnum(BudgetPeriod, { message: 'Budget period must be MONTHLY or WEEKLY' })
  period: BudgetPeriod;
}

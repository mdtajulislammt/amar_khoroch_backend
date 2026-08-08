import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, Matches } from 'class-validator';
import { CategoryType } from '@prisma/client';

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Medical Expenses', description: 'Category name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'EXPENSE', enum: CategoryType, description: 'Category type (INCOME or EXPENSE)' })
  @IsOptional()
  @IsEnum(CategoryType, { message: 'Type must be INCOME or EXPENSE' })
  type?: CategoryType;

  @ApiPropertyOptional({ example: 'Stethoscope', description: 'Lucide icon identifier' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: '#ef4444', description: 'Hex color code string' })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'Please provide a valid Hex Color Code (e.g., #ef4444)' })
  color?: string;
}

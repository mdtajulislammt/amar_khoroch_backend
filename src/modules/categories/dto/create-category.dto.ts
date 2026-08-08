import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum, Matches } from 'class-validator';
import { CategoryType } from '@prisma/client';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Healthcare & Medical', description: 'Name of the category' })
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  name: string;

  @ApiProperty({ example: 'EXPENSE', enum: CategoryType, description: 'Category type (INCOME or EXPENSE)' })
  @IsEnum(CategoryType, { message: 'Type must be INCOME or EXPENSE' })
  type: CategoryType;

  @ApiProperty({ example: 'Stethoscope', description: 'Lucide icon identifier' })
  @IsString()
  @IsNotEmpty({ message: 'Icon name is required' })
  icon: string;

  @ApiProperty({ example: '#ef4444', description: 'Hex color code string (e.g., #ef4444)' })
  @IsString()
  @IsNotEmpty({ message: 'Color code is required' })
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, { message: 'Please provide a valid Hex Color Code (e.g., #ef4444)' })
  color: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsEnum, IsOptional, IsBoolean, Min, Matches } from 'class-validator';
import { DebtType } from '@prisma/client';

export class CreateDebtDto {
  @ApiProperty({ example: 'Rafiq Bhai', description: 'Name of the person involved' })
  @IsString()
  @IsNotEmpty({ message: 'Person name is required' })
  personName: string;

  @ApiProperty({ example: 'GIVEN', enum: DebtType, description: 'Debt type (GIVEN or TAKEN)' })
  @IsEnum(DebtType, { message: 'Type must be GIVEN or TAKEN' })
  type: DebtType;

  @ApiProperty({ example: 5000, description: 'Debt monetary amount' })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(1, { message: 'Amount must be greater than 0' })
  amount: number;

  @ApiPropertyOptional({ example: '2026-08-25', description: 'Due date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Due date must be formatted as YYYY-MM-DD' })
  dueDate?: string;

  @ApiPropertyOptional({ example: 'wallet-uuid', description: 'Wallet ID associated with debt' })
  @IsOptional()
  @IsString()
  walletId?: string;

  @ApiPropertyOptional({ example: false, description: 'Is debt cleared/settled' })
  @IsOptional()
  @IsBoolean()
  isCleared?: boolean;
}

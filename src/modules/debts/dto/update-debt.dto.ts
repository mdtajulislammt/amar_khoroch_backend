import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString, IsEnum, IsBoolean, Min, Matches } from 'class-validator';
import { DebtType } from '@prisma/client';

export class UpdateDebtDto {
  @ApiPropertyOptional({ example: 'Rafiq Bhai', description: 'Name of the person involved' })
  @IsOptional()
  @IsString()
  personName?: string;

  @ApiPropertyOptional({ example: 'GIVEN', enum: DebtType, description: 'Debt type (GIVEN or TAKEN)' })
  @IsOptional()
  @IsEnum(DebtType, { message: 'Type must be GIVEN or TAKEN' })
  type?: DebtType;

  @ApiPropertyOptional({ example: 5000, description: 'Debt monetary amount' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

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

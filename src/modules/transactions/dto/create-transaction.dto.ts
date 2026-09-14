import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  Min,
  ValidateIf,
  Matches,
} from 'class-validator';
import { TransactionType, RecurrenceFrequency } from '@prisma/client';

export class CreateTransactionDto {
  @ApiProperty({ example: 'EXPENSE', enum: TransactionType, description: 'Transaction type (INCOME, EXPENSE, TRANSFER)' })
  @IsEnum(TransactionType, { message: 'Type must be INCOME, EXPENSE, or TRANSFER' })
  type: TransactionType;

  @ApiProperty({ example: 1200, description: 'Transaction amount' })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount: number;

  @ApiProperty({ example: 'w1', description: 'Source wallet ID' })
  @IsString()
  @IsNotEmpty({ message: 'Source wallet ID is required' })
  walletId: string;

  @ApiPropertyOptional({ example: 'c1', description: 'Category ID (Required for INCOME/EXPENSE)' })
  @ValidateIf((o) => o.type === TransactionType.INCOME || o.type === TransactionType.EXPENSE)
  @IsString()
  @IsNotEmpty({ message: 'Category ID is required for INCOME and EXPENSE transactions' })
  categoryId?: string;

  @ApiPropertyOptional({ example: 'w2', description: 'Target wallet ID (Required for TRANSFER)' })
  @ValidateIf((o) => o.type === TransactionType.TRANSFER)
  @IsString()
  @IsNotEmpty({ message: 'Target wallet ID (toWalletId) is required for TRANSFER transactions' })
  toWalletId?: string;

  @ApiProperty({ example: '2026-08-08', description: 'Transaction date (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty({ message: 'Date is required' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be formatted as YYYY-MM-DD' })
  date: string;

  @ApiPropertyOptional({ example: '10:30 AM', description: 'Transaction time' })
  @IsOptional()
  @IsString()
  time?: string;

  @ApiPropertyOptional({ example: 'Weekly Grocery Shopping', description: 'Note or description' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: false, description: 'Whether transaction is recurring' })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({ example: 'MONTHLY', enum: RecurrenceFrequency, description: 'Recurrence frequency (DAILY, WEEKLY, MONTHLY)' })
  @ValidateIf((o) => o.isRecurring === true)
  @IsEnum(RecurrenceFrequency, { message: 'Frequency must be DAILY, WEEKLY, or MONTHLY' })
  frequency?: RecurrenceFrequency;

  @ApiPropertyOptional({ example: '2026-09-08', description: 'Next auto execution date (YYYY-MM-DD)' })
  @ValidateIf((o) => o.isRecurring === true)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Next execution date must be formatted as YYYY-MM-DD' })
  nextExecutionDate?: string;
}

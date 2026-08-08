import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class DepositSavingDto {
  @ApiProperty({ example: 2000, description: 'Deposit amount to add to savings goal' })
  @IsNumber({}, { message: 'Deposit amount must be a number' })
  @Min(1, { message: 'Deposit amount must be greater than 0' })
  amount: number;

  @ApiProperty({ example: 'w1', description: 'Wallet ID to deduct money from' })
  @IsString()
  @IsNotEmpty({ message: 'Source wallet ID is required' })
  walletId: string;
}

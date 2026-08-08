import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsEnum, Min } from 'class-validator';
import { WalletType } from '@prisma/client';

export class CreateWalletDto {
  @ApiProperty({ example: 'bKash Account', description: 'Name of the wallet' })
  @IsString()
  @IsNotEmpty({ message: 'Wallet name is required' })
  name: string;

  @ApiProperty({ example: 'MOBILE_BANKING', enum: WalletType, description: 'Type of wallet (CASH, BANK, MOBILE_BANKING)' })
  @IsEnum(WalletType, { message: 'Wallet type must be CASH, BANK, or MOBILE_BANKING' })
  type: WalletType;

  @ApiProperty({ example: 5000, description: 'Initial opening balance' })
  @IsNumber({}, { message: 'Balance must be a number' })
  @Min(0, { message: 'Initial balance cannot be negative' })
  balance: number;

  @ApiProperty({ example: 'Smartphone', description: 'Lucide icon identifier' })
  @IsString()
  @IsNotEmpty({ message: 'Icon identifier is required' })
  icon: string;
}

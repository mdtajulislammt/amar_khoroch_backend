import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { WalletType } from '@prisma/client';

export class UpdateWalletDto {
  @ApiPropertyOptional({ example: 'Updated Wallet Name', description: 'Name of the wallet' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'BANK', enum: WalletType, description: 'Type of wallet (CASH, BANK, MOBILE_BANKING)' })
  @IsOptional()
  @IsEnum(WalletType, { message: 'Wallet type must be CASH, BANK, or MOBILE_BANKING' })
  type?: WalletType;

  @ApiPropertyOptional({ example: 'Landmark', description: 'Lucide icon identifier' })
  @IsOptional()
  @IsString()
  icon?: string;
}

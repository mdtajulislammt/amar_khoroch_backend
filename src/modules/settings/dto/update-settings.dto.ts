import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'w1', description: 'Default active wallet ID' })
  @IsOptional()
  @IsString()
  activeWalletId?: string;

  @ApiPropertyOptional({ example: 'en', description: 'App language selection ("bn" or "en")' })
  @IsOptional()
  @IsIn(['bn', 'en'], { message: 'Language must be either bn or en' })
  language?: string;
}

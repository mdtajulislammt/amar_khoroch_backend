import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsBoolean, IsInt, Min, Max } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'w1', description: 'Default active wallet ID' })
  @IsOptional()
  @IsString()
  activeWalletId?: string;

  @ApiPropertyOptional({ example: 'en', description: 'App language selection ("bn" or "en")' })
  @IsOptional()
  @IsIn(['bn', 'en'], { message: 'Language must be either bn or en' })
  language?: string;

  @ApiPropertyOptional({ example: true, description: 'Enable or disable PIN lock' })
  @IsOptional()
  @IsBoolean()
  isPinEnabled?: boolean;

  @ApiPropertyOptional({ example: 1, description: 'Auto lock hours (0 = immediate, 1, 2, 3 hours)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24)
  autoLockHours?: number;
}

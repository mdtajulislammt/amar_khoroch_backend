import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AnnouncementType } from '@prisma/client';

export class CreateAnnouncementDto {
  @ApiProperty({ example: 'System Maintenance Scheduled' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'The system will undergo routine updates tonight from 2:00 AM to 2:30 AM.' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ enum: AnnouncementType, default: AnnouncementType.INFO })
  @IsEnum(AnnouncementType)
  @IsOptional()
  type?: AnnouncementType;

  @ApiPropertyOptional({ example: '2026-09-20T00:00:00.000Z' })
  @IsOptional()
  expiresAt?: string;
}

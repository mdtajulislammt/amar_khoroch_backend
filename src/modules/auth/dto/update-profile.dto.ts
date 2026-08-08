import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'MD Tajul Islam', description: 'Updated user full name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '+8801712345678', description: 'Updated phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Pro Member', description: 'User role title' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg', description: 'Avatar image URL' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ example: 'USD ($)', description: 'Updated currency code' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'Personal finance enthusiast.', description: 'Short bio' })
  @IsOptional()
  @IsString()
  bio?: string;
}

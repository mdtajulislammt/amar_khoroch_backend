import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { AccountStatus } from '@prisma/client';

export class UpdateUserStatusDto {
  @ApiProperty({ enum: AccountStatus, example: AccountStatus.BANNED })
  @IsEnum(AccountStatus, { message: 'Status must be ACTIVE, SUSPENDED, or BANNED' })
  @IsNotEmpty()
  status: AccountStatus;
}

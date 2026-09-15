import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: Role, example: Role.ADMIN })
  @IsEnum(Role, { message: 'Role must be USER, MODERATOR, ADMIN, or SUPER_ADMIN' })
  @IsNotEmpty()
  role: Role;
}

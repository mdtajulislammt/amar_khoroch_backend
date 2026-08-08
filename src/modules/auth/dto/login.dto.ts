import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'tajul@example.com', description: 'Registered email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'Secret@123', description: 'User account password' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({ example: 'john.doe@gmail.com', description: 'Google Email address' })
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'John Doe', description: 'Full name from Google' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @ApiPropertyOptional({ example: 'https://lh3.googleusercontent.com/a/ACg8oc...', description: 'Google Profile Avatar URL' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ example: '109283749182374', description: 'Google Sub / ID' })
  @IsOptional()
  @IsString()
  googleId?: string;
}

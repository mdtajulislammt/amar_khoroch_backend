import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Length } from 'class-validator';

export class RequestAdminPasswordOtpDto {
  @ApiProperty({
    description: 'Current admin password for identity validation before sending OTP',
    example: 'Admin@12345',
  })
  @IsNotEmpty({ message: 'বর্তমান পাসওয়ার্ড প্রদান করুন' })
  @IsString()
  currentPassword: string;
}

export class ConfirmAdminPasswordChangeDto {
  @ApiProperty({
    description: 'Current admin password',
    example: 'Admin@12345',
  })
  @IsNotEmpty({ message: 'বর্তমান পাসওয়ার্ড প্রদান করুন' })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description: 'New password (minimum 6 characters)',
    example: 'NewSecretPass@2026',
  })
  @IsNotEmpty({ message: 'নতুন পাসওয়ার্ড প্রদান করুন' })
  @IsString()
  @MinLength(6, { message: 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' })
  newPassword: string;

  @ApiProperty({
    description: '6-digit OTP received in admin email',
    example: '492813',
  })
  @IsNotEmpty({ message: '৬-সংখ্যার ভেরিফিকেশন ওটিপি প্রদান করুন' })
  @IsString()
  @Length(6, 6, { message: 'ওটিপি কোড ঠিক ৬ সংখ্যার হতে হবে' })
  otp: string;
}

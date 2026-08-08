import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class PinDto {
  @ApiProperty({ example: '1234', description: '4-digit security PIN code' })
  @IsString()
  @IsNotEmpty({ message: 'PIN code is required' })
  @Length(4, 4, { message: 'PIN code must be exactly 4 digits' })
  @Matches(/^[0-9]{4}$/, { message: 'PIN code must contain digits only' })
  pinCode: string;
}

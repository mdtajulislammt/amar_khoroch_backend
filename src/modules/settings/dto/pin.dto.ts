import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class PinDto {
  @ApiProperty({ example: '1234', description: '4 or 5-digit security PIN code' })
  @IsString()
  @IsNotEmpty({ message: 'PIN code is required' })
  @Length(4, 5, { message: 'PIN code must be 4 or 5 digits' })
  @Matches(/^[0-9]{4,5}$/, { message: 'PIN code must contain digits only' })
  pinCode: string;
}

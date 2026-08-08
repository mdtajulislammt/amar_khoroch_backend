import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateNoteDto {
  @ApiProperty({ example: 'Weekly Shopping List', description: 'Title of the note or task' })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @ApiPropertyOptional({ example: 'Buy milk, eggs, bread, and fruits', description: 'Detailed note content' })
  @IsOptional()
  @IsString()
  content?: string;
}

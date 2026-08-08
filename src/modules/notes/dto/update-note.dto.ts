import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateNoteDto {
  @ApiPropertyOptional({ example: 'Updated Note Title', description: 'Title of the note' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Updated note content details', description: 'Content of the note' })
  @IsOptional()
  @IsString()
  content?: string;
}

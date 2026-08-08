import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Notes & Tasks')
@ApiBearerAuth()
@Controller('api/v1/notes')
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @ApiOperation({ summary: 'Get Notes List', description: 'Retrieve all notes and task reminders.' })
  @ApiResponse({ status: 200, description: 'Notes retrieved successfully' })
  async getNotes(@CurrentUser('id') userId: string) {
    const data = await this.notesService.getNotes(userId);
    return {
      message: 'Notes retrieved successfully',
      data,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Add Note', description: 'Create a new note or task.' })
  @ApiResponse({ status: 201, description: 'Note created successfully' })
  async createNote(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateNoteDto,
  ) {
    const data = await this.notesService.createNote(userId, dto);
    return {
      message: 'Note created successfully',
      data,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update Note', description: 'Update note title or content by ID.' })
  @ApiParam({ name: 'id', description: 'Note ID' })
  @ApiResponse({ status: 200, description: 'Note updated successfully' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async updateNote(
    @CurrentUser('id') userId: string,
    @Param('id') noteId: string,
    @Body() dto: UpdateNoteDto,
  ) {
    const data = await this.notesService.updateNote(userId, noteId, dto);
    return {
      message: 'Note updated successfully',
      data,
    };
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle Note Status', description: 'Toggle task completion status (true/false).' })
  @ApiParam({ name: 'id', description: 'Note ID' })
  @ApiResponse({ status: 200, description: 'Note status updated' })
  async toggleNote(
    @CurrentUser('id') userId: string,
    @Param('id') noteId: string,
  ) {
    const data = await this.notesService.toggleNote(userId, noteId);
    return {
      message: 'Note status updated',
      data,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Note', description: 'Delete a note by ID.' })
  @ApiParam({ name: 'id', description: 'Note ID' })
  @ApiResponse({ status: 200, description: 'Note deleted successfully' })
  async deleteNote(
    @CurrentUser('id') userId: string,
    @Param('id') noteId: string,
  ) {
    const data = await this.notesService.deleteNote(userId, noteId);
    return {
      message: data.message,
      data: null,
    };
  }
}

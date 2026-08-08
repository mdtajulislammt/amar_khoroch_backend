import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Injectable()
export class NotesService {
  constructor(private prisma: PrismaService) {}

  async getNotes(userId: string) {
    return await this.prisma.note.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        content: true,
        isCompleted: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createNote(userId: string, dto: CreateNoteDto) {
    return await this.prisma.note.create({
      data: {
        userId,
        title: dto.title,
        content: dto.content || null,
      },
      select: {
        id: true,
        title: true,
        content: true,
        isCompleted: true,
        createdAt: true,
      },
    });
  }

  async updateNote(userId: string, noteId: string, dto: UpdateNoteDto) {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, userId },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    return await this.prisma.note.update({
      where: { id: noteId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
      },
      select: {
        id: true,
        title: true,
        content: true,
        isCompleted: true,
        createdAt: true,
      },
    });
  }

  async toggleNote(userId: string, noteId: string) {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, userId },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    return await this.prisma.note.update({
      where: { id: noteId },
      data: { isCompleted: !note.isCompleted },
      select: {
        id: true,
        title: true,
        content: true,
        isCompleted: true,
        createdAt: true,
      },
    });
  }

  async deleteNote(userId: string, noteId: string) {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, userId },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    await this.prisma.note.delete({
      where: { id: noteId },
    });

    return { message: 'Note deleted successfully' };
  }
}

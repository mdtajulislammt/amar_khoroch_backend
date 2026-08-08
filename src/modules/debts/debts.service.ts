import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';

@Injectable()
export class DebtsService {
  constructor(private prisma: PrismaService) {}

  async getDebts(userId: string) {
    return await this.prisma.debt.findMany({
      where: { userId },
      select: {
        id: true,
        personName: true,
        type: true,
        amount: true,
        dueDate: true,
        isCleared: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDebt(userId: string, dto: CreateDebtDto) {
    return await this.prisma.debt.create({
      data: {
        userId,
        personName: dto.personName,
        type: dto.type,
        amount: dto.amount,
        dueDate: dto.dueDate || null,
      },
      select: {
        id: true,
        personName: true,
        type: true,
        amount: true,
        dueDate: true,
        isCleared: true,
      },
    });
  }

  async updateDebt(userId: string, debtId: string, dto: UpdateDebtDto) {
    const debt = await this.prisma.debt.findFirst({
      where: { id: debtId, userId },
    });

    if (!debt) {
      throw new NotFoundException('Debt record not found');
    }

    return await this.prisma.debt.update({
      where: { id: debtId },
      data: {
        ...(dto.personName && { personName: dto.personName }),
        ...(dto.type && { type: dto.type }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate }),
      },
      select: {
        id: true,
        personName: true,
        type: true,
        amount: true,
        dueDate: true,
        isCleared: true,
      },
    });
  }

  async toggleDebt(userId: string, debtId: string) {
    const debt = await this.prisma.debt.findFirst({
      where: { id: debtId, userId },
    });

    if (!debt) {
      throw new NotFoundException('Debt record not found');
    }

    return await this.prisma.debt.update({
      where: { id: debtId },
      data: { isCleared: !debt.isCleared },
      select: {
        id: true,
        personName: true,
        type: true,
        amount: true,
        dueDate: true,
        isCleared: true,
      },
    });
  }

  async deleteDebt(userId: string, debtId: string) {
    const debt = await this.prisma.debt.findFirst({
      where: { id: debtId, userId },
    });

    if (!debt) {
      throw new NotFoundException('Debt record not found');
    }

    await this.prisma.debt.delete({
      where: { id: debtId },
    });

    return { message: 'Debt record deleted successfully' };
  }
}

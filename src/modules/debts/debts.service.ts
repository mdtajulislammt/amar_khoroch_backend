import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';
import { DebtType, TransactionType } from '@prisma/client';

@Injectable()
export class DebtsService {
  constructor(private prisma: PrismaService) {}

  private async getOrCreateDebtCategory(tx: any, userId: string, type: 'INCOME' | 'EXPENSE') {
    let category = await tx.category.findFirst({
      where: {
        userId,
        name: 'দেনা-পাওনা (Debts & Loans)',
      },
    });

    if (!category) {
      category = await tx.category.create({
        data: {
          userId,
          name: 'দেনা-পাওনা (Debts & Loans)',
          type: type === 'INCOME' ? 'INCOME' : 'EXPENSE',
          color: '#8b5cf6',
          icon: 'ArrowLeftRight',
        },
      });
    }

    return category;
  }

  async getDebts(userId: string) {
    return await this.prisma.debt.findMany({
      where: { userId },
      select: {
        id: true,
        walletId: true,
        personName: true,
        type: true,
        amount: true,
        dueDate: true,
        isCleared: true,
        wallet: {
          select: { id: true, name: true, balance: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDebt(userId: string, dto: CreateDebtDto) {
    return await this.prisma.$transaction(async (tx) => {
      const debt = await tx.debt.create({
        data: {
          userId,
          walletId: dto.walletId || null,
          personName: dto.personName,
          type: dto.type,
          amount: dto.amount,
          dueDate: dto.dueDate || null,
        },
        select: {
          id: true,
          walletId: true,
          personName: true,
          type: true,
          amount: true,
          dueDate: true,
          isCleared: true,
          wallet: {
            select: { id: true, name: true, balance: true },
          },
        },
      });

      if (dto.walletId) {
        const isGiven = dto.type === DebtType.GIVEN;
        const catType = isGiven ? 'EXPENSE' : 'INCOME';
        const category = await this.getOrCreateDebtCategory(tx, userId, catType);

        // 1. Create automatic Transaction
        const today = new Date().toISOString().slice(0, 10);
        const noteText = isGiven
          ? `${dto.personName}-কে ধার দেওয়া হয়েছে`
          : `${dto.personName}-এর কাছ থেকে ধার নেওয়া হয়েছে`;

        await tx.transaction.create({
          data: {
            userId,
            walletId: dto.walletId,
            categoryId: category.id,
            type: isGiven ? TransactionType.EXPENSE : TransactionType.INCOME,
            amount: dto.amount,
            date: today,
            note: noteText,
          },
        });

        // 2. Adjust Wallet Balance
        const balanceChange = isGiven ? -dto.amount : dto.amount;
        await tx.wallet.update({
          where: { id: dto.walletId },
          data: { balance: { increment: balanceChange } },
        });
      }

      return debt;
    });
  }

  async updateDebt(userId: string, debtId: string, dto: UpdateDebtDto) {
    return await this.prisma.$transaction(async (tx) => {
      const oldDebt = await tx.debt.findFirst({
        where: { id: debtId, userId },
      });

      if (!oldDebt) {
        throw new NotFoundException('Debt record not found');
      }

      // Revert old wallet impact if uncleared
      if (oldDebt.walletId && !oldDebt.isCleared) {
        const revertChange = oldDebt.type === DebtType.GIVEN ? oldDebt.amount : -oldDebt.amount;
        await tx.wallet.update({
          where: { id: oldDebt.walletId },
          data: { balance: { increment: revertChange } },
        });
      }

      const updated = await tx.debt.update({
        where: { id: debtId },
        data: {
          ...(dto.walletId !== undefined && { walletId: dto.walletId }),
          ...(dto.personName && { personName: dto.personName }),
          ...(dto.type && { type: dto.type }),
          ...(dto.amount !== undefined && { amount: dto.amount }),
          ...(dto.dueDate !== undefined && { dueDate: dto.dueDate }),
        },
        select: {
          id: true,
          walletId: true,
          personName: true,
          type: true,
          amount: true,
          dueDate: true,
          isCleared: true,
          wallet: {
            select: { id: true, name: true, balance: true },
          },
        },
      });

      // Apply new wallet impact if uncleared
      if (updated.walletId && !updated.isCleared) {
        const applyChange = updated.type === DebtType.GIVEN ? -updated.amount : updated.amount;
        await tx.wallet.update({
          where: { id: updated.walletId },
          data: { balance: { increment: applyChange } },
        });
      }

      return updated;
    });
  }

  async toggleDebt(userId: string, debtId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findFirst({
        where: { id: debtId, userId },
      });

      if (!debt) {
        throw new NotFoundException('Debt record not found');
      }

      const newIsCleared = !debt.isCleared;

      const updated = await tx.debt.update({
        where: { id: debtId },
        data: { isCleared: newIsCleared },
        select: {
          id: true,
          walletId: true,
          personName: true,
          type: true,
          amount: true,
          dueDate: true,
          isCleared: true,
          wallet: {
            select: { id: true, name: true, balance: true },
          },
        },
      });

      if (debt.walletId) {
        let balanceChange = 0;
        if (newIsCleared) {
          balanceChange = debt.type === DebtType.GIVEN ? debt.amount : -debt.amount;

          // Record repayment transaction
          const isGiven = debt.type === DebtType.GIVEN;
          const catType = isGiven ? 'INCOME' : 'EXPENSE';
          const category = await this.getOrCreateDebtCategory(tx, userId, catType);
          const today = new Date().toISOString().slice(0, 10);
          const noteText = isGiven
            ? `${debt.personName}-এর পাওনা পরিশোধিত (ফেরত)`
            : `${debt.personName}-এর দেনা পরিশোধিত`;

          await tx.transaction.create({
            data: {
              userId,
              walletId: debt.walletId,
              categoryId: category.id,
              type: isGiven ? TransactionType.INCOME : TransactionType.EXPENSE,
              amount: debt.amount,
              date: today,
              note: noteText,
            },
          });
        } else {
          balanceChange = debt.type === DebtType.GIVEN ? -debt.amount : debt.amount;
        }

        await tx.wallet.update({
          where: { id: debt.walletId },
          data: { balance: { increment: balanceChange } },
        });
      }

      return updated;
    });
  }

  async deleteDebt(userId: string, debtId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findFirst({
        where: { id: debtId, userId },
      });

      if (!debt) {
        throw new NotFoundException('Debt record not found');
      }

      if (debt.walletId && !debt.isCleared) {
        // Revert uncleared debt impact on wallet
        const revertChange = debt.type === DebtType.GIVEN ? debt.amount : -debt.amount;
        await tx.wallet.update({
          where: { id: debt.walletId },
          data: { balance: { increment: revertChange } },
        });
      }

      await tx.debt.delete({
        where: { id: debtId },
      });

      return { message: 'Debt record deleted successfully' };
    });
  }
}

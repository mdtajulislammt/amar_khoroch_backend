import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';
import { DebtType, TransactionType } from '@prisma/client';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class DebtsService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

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
        const noteText = `[DEBT_INIT:${debt.id}] ` + (isGiven
          ? `${dto.personName}-কে ধার দেওয়া হয়েছে`
          : `${dto.personName}-এর কাছ থেকে ধার নেওয়া হয়েছে`);

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

      await this.redisService.invalidateUserCache(userId);
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

      // Sync auto-created initial and clearance transactions
      if (updated.walletId) {
        const isGiven = updated.type === DebtType.GIVEN;
        const catType = isGiven ? 'EXPENSE' : 'INCOME';
        const category = await this.getOrCreateDebtCategory(tx, userId, catType);

        await tx.transaction.updateMany({
          where: {
            userId,
            note: { startsWith: `[DEBT_INIT:${debtId}]` },
          },
          data: {
            amount: updated.amount,
            walletId: updated.walletId,
            categoryId: category.id,
            type: isGiven ? TransactionType.EXPENSE : TransactionType.INCOME,
            note: `[DEBT_INIT:${debtId}] ${isGiven ? `${updated.personName}-কে ধার দেওয়া হয়েছে` : `${updated.personName}-এর কাছ থেকে ধার নেওয়া হয়েছে`}`,
          },
        });

        if (updated.isCleared) {
          const clearCatType = isGiven ? 'INCOME' : 'EXPENSE';
          const clearCategory = await this.getOrCreateDebtCategory(tx, userId, clearCatType);
          await tx.transaction.updateMany({
            where: {
              userId,
              note: { startsWith: `[DEBT_CLEAR:${debtId}]` },
            },
            data: {
              amount: updated.amount,
              walletId: updated.walletId,
              categoryId: clearCategory.id,
              type: isGiven ? TransactionType.INCOME : TransactionType.EXPENSE,
              note: `[DEBT_CLEAR:${debtId}] ${isGiven ? `${updated.personName}-এর পাওনা পরিশোধিত (ফেরত)` : `${updated.personName}-এর দেনা পরিশোধিত`}`,
            },
          });
        }
      }

      await this.redisService.invalidateUserCache(userId);
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
          const noteText = `[DEBT_CLEAR:${debt.id}] ` + (isGiven
            ? `${debt.personName}-এর পাওনা পরিশোধিত (ফেরত)`
            : `${debt.personName}-এর দেনা পরিশোধিত`);

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

          // Delete repayment transaction
          await tx.transaction.deleteMany({
            where: {
              userId,
              note: { startsWith: `[DEBT_CLEAR:${debtId}]` },
            },
          });
        }

        await tx.wallet.update({
          where: { id: debt.walletId },
          data: { balance: { increment: balanceChange } },
        });
      }

      await this.redisService.invalidateUserCache(userId);
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

      // Delete associated transactions
      await tx.transaction.deleteMany({
        where: {
          userId,
          OR: [
            { note: { startsWith: `[DEBT_INIT:${debtId}]` } },
            { note: { startsWith: `[DEBT_CLEAR:${debtId}]` } },
          ],
        },
      });

      await tx.debt.delete({
        where: { id: debtId },
      });

      await this.redisService.invalidateUserCache(userId);
      return { message: 'Debt record and associated transactions deleted successfully' };
    });
  }
}

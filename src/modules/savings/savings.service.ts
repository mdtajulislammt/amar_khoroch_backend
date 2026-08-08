import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CreateSavingGoalDto } from './dto/create-saving-goal.dto';
import { UpdateSavingGoalDto } from './dto/update-saving-goal.dto';
import { DepositSavingDto } from './dto/deposit-saving.dto';

@Injectable()
export class SavingsService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async getSavingGoals(userId: string) {
    const goals = await this.prisma.savingGoal.findMany({
      where: { userId },
      select: {
        id: true,
        goalName: true,
        targetAmount: true,
        currentAmount: true,
        targetDate: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return goals;
  }

  async createSavingGoal(userId: string, dto: CreateSavingGoalDto) {
    const goal = await this.prisma.savingGoal.create({
      data: {
        userId,
        goalName: dto.goalName,
        targetAmount: dto.targetAmount,
        currentAmount: dto.currentAmount || 0,
        targetDate: dto.targetDate || null,
      },
      select: {
        id: true,
        goalName: true,
        targetAmount: true,
        currentAmount: true,
        targetDate: true,
      },
    });

    return goal;
  }

  async updateSavingGoal(userId: string, goalId: string, dto: UpdateSavingGoalDto) {
    const goal = await this.prisma.savingGoal.findFirst({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new NotFoundException('Savings goal not found');
    }

    const updated = await this.prisma.savingGoal.update({
      where: { id: goalId },
      data: {
        ...(dto.goalName && { goalName: dto.goalName }),
        ...(dto.targetAmount !== undefined && { targetAmount: dto.targetAmount }),
        ...(dto.targetDate !== undefined && { targetDate: dto.targetDate }),
      },
      select: {
        id: true,
        goalName: true,
        targetAmount: true,
        currentAmount: true,
        targetDate: true,
      },
    });

    return updated;
  }

  async deleteSavingGoal(userId: string, goalId: string) {
    const goal = await this.prisma.savingGoal.findFirst({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new NotFoundException('Savings goal not found');
    }

    await this.prisma.savingGoal.delete({
      where: { id: goalId },
    });

    await this.redisService.invalidateUserCache(userId);

    return { message: 'Savings goal deleted successfully' };
  }

  async depositSavingGoal(userId: string, goalId: string, dto: DepositSavingDto) {
    return await this.prisma.$transaction(async (tx) => {
      const goal = await tx.savingGoal.findFirst({
        where: { id: goalId, userId },
      });
      if (!goal) {
        throw new NotFoundException('Savings goal not found');
      }

      const wallet = await tx.wallet.findFirst({
        where: { id: dto.walletId, userId },
      });
      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      // Deduct from wallet & Add to goal currentAmount
      await tx.wallet.update({
        where: { id: dto.walletId },
        data: { balance: { decrement: dto.amount } },
      });

      const updatedGoal = await tx.savingGoal.update({
        where: { id: goalId },
        data: { currentAmount: { increment: dto.amount } },
      });

      const today = new Date().toISOString().split('T')[0];
      const history = await tx.savingHistory.create({
        data: {
          savingId: goalId,
          walletId: dto.walletId,
          amount: dto.amount,
          date: today,
        },
      });

      await this.redisService.invalidateUserCache(userId);

      return {
        goal: updatedGoal,
        history,
      };
    });
  }

  async getSavingHistory(userId: string, savingId?: string) {
    const where: any = {
      savingGoal: {
        userId,
      },
    };

    if (savingId) {
      where.savingId = savingId;
    }

    const histories = await this.prisma.savingHistory.findMany({
      where,
      include: {
        savingGoal: {
          select: { goalName: true },
        },
        wallet: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return histories.map((h) => ({
      id: h.id,
      savingId: h.savingId,
      goalName: h.savingGoal ? h.savingGoal.goalName : 'Unknown',
      walletId: h.walletId,
      walletName: h.wallet ? h.wallet.name : 'Unknown',
      amount: h.amount,
      date: h.date,
    }));
  }

  async deleteSavingHistory(userId: string, historyId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const history = await tx.savingHistory.findFirst({
        where: {
          id: historyId,
          savingGoal: { userId },
        },
      });

      if (!history) {
        throw new NotFoundException('Savings history record not found');
      }

      // Revert goal currentAmount and wallet balance
      await tx.savingGoal.update({
        where: { id: history.savingId },
        data: { currentAmount: { decrement: history.amount } },
      });

      await tx.wallet.update({
        where: { id: history.walletId },
        data: { balance: { increment: history.amount } },
      });

      await tx.savingHistory.delete({
        where: { id: historyId },
      });

      await this.redisService.invalidateUserCache(userId);

      return { message: 'Savings deposit record deleted and amount refunded to wallet' };
    });
  }
}

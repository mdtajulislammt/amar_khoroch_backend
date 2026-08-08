import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { TransactionType } from '@prisma/client';

@Injectable()
export class BudgetsService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async getBudgets(userId: string) {
    const budgets = await this.prisma.budget.findMany({
      where: { userId },
      include: {
        category: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const startOfMonth = `${currentYear}-${currentMonth}-01`;
    const endOfMonth = `${currentYear}-${currentMonth}-31`;

    // Calculate current week range
    const dayOfWeek = now.getDay();
    const diffToMon = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const startOfWeekDate = new Date(now.setDate(diffToMon));
    const startOfWeek = startOfWeekDate.toISOString().split('T')[0];
    const endOfWeek = new Date().toISOString().split('T')[0];

    const results = await Promise.all(
      budgets.map(async (b) => {
        const startDate = b.period === 'MONTHLY' ? startOfMonth : startOfWeek;
        const endDate = b.period === 'MONTHLY' ? endOfMonth : endOfWeek;

        const aggregate = await this.prisma.transaction.aggregate({
          _sum: { amount: true },
          where: {
            userId,
            categoryId: b.categoryId,
            type: TransactionType.EXPENSE,
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        });

        return {
          id: b.id,
          categoryId: b.categoryId,
          categoryName: b.category ? b.category.name : 'Unknown',
          limitAmount: b.limitAmount,
          spentAmount: aggregate._sum.amount || 0,
          period: b.period,
        };
      }),
    );

    return results;
  }

  async createBudget(userId: string, dto: CreateBudgetDto) {
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, userId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const budget = await this.prisma.budget.upsert({
      where: {
        userId_categoryId_period: {
          userId,
          categoryId: dto.categoryId,
          period: dto.period,
        },
      },
      update: {
        limitAmount: dto.limitAmount,
      },
      create: {
        userId,
        categoryId: dto.categoryId,
        limitAmount: dto.limitAmount,
        period: dto.period,
      },
      include: {
        category: {
          select: { name: true },
        },
      },
    });

    return {
      id: budget.id,
      categoryId: budget.categoryId,
      categoryName: budget.category.name,
      limitAmount: budget.limitAmount,
      spentAmount: 0,
      period: budget.period,
    };
  }

  async deleteBudget(userId: string, budgetId: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id: budgetId, userId },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    await this.prisma.budget.delete({
      where: { id: budgetId },
    });

    return { message: 'Budget deleted successfully' };
  }
}

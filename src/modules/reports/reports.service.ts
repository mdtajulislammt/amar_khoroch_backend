import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { TransactionType, CategoryType } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async getSummary(userId: string) {
    const cacheKey = `user:${userId}:summary`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return cached;

    const [wallets, aggregateIncome, aggregateExpense] = await Promise.all([
      this.prisma.wallet.findMany({
        where: { userId },
        select: { balance: true },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { userId, type: TransactionType.INCOME },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { userId, type: TransactionType.EXPENSE },
      }),
    ]);

    const totalBalance = wallets.reduce((acc, curr) => acc + curr.balance, 0);
    const totalIncome = aggregateIncome._sum.amount || 0;
    const totalExpense = aggregateExpense._sum.amount || 0;
    const netSavings = totalIncome - totalExpense;
    const activeWalletsCount = wallets.length;

    const summaryData = {
      totalBalance,
      totalIncome,
      totalExpense,
      netSavings,
      activeWalletsCount,
    };

    await this.redisService.set(cacheKey, summaryData, 300);
    return summaryData;
  }

  async getCashflow(userId: string, period: 'monthly' | 'weekly' = 'monthly') {
    const cacheKey = `user:${userId}:cashflow:${period}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return cached;

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
      },
      select: {
        type: true,
        amount: true,
        date: true,
      },
      orderBy: { date: 'asc' },
    });

    const grouped: { [key: string]: { income: number; expense: number } } = {};

    transactions.forEach((t) => {
      let key = t.date;
      if (period === 'monthly' && t.date.length >= 7) {
        key = t.date.substring(0, 7); // YYYY-MM
      }

      if (!grouped[key]) {
        grouped[key] = { income: 0, expense: 0 };
      }

      if (t.type === TransactionType.INCOME) {
        grouped[key].income += t.amount;
      } else if (t.type === TransactionType.EXPENSE) {
        grouped[key].expense += t.amount;
      }
    });

    const data = Object.keys(grouped).map((label) => ({
      label,
      income: grouped[label].income,
      expense: grouped[label].expense,
    }));

    await this.redisService.set(cacheKey, data, 300);
    return data;
  }

  async getCategoryBreakdown(userId: string, type: CategoryType = CategoryType.EXPENSE) {
    const cacheKey = `user:${userId}:breakdown:${type}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return cached;

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: type === CategoryType.EXPENSE ? TransactionType.EXPENSE : TransactionType.INCOME,
        categoryId: { not: null },
      },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    const categoryTotals: {
      [key: string]: { categoryId: string; categoryName: string; color: string; amount: number };
    } = {};

    let totalAmount = 0;

    transactions.forEach((t) => {
      if (!t.category) return;
      const catId = t.category.id;
      totalAmount += t.amount;

      if (!categoryTotals[catId]) {
        categoryTotals[catId] = {
          categoryId: catId,
          categoryName: t.category.name,
          color: t.category.color,
          amount: 0,
        };
      }

      categoryTotals[catId].amount += t.amount;
    });

    const data = Object.values(categoryTotals).map((item) => ({
      ...item,
      percentage: totalAmount > 0 ? Number(((item.amount / totalAmount) * 100).toFixed(2)) : 0,
    }));

    await this.redisService.set(cacheKey, data, 300);
    return data;
  }

  async exportUserData(userId: string) {
    const [user, settings, wallets, categories, transactions, budgets, savingGoals, debts, notes] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true, phone: true, role: true, avatar: true, currency: true, bio: true, createdAt: true },
        }),
        this.prisma.appSetting.findUnique({ where: { userId } }),
        this.prisma.wallet.findMany({ where: { userId } }),
        this.prisma.category.findMany({ where: { userId } }),
        this.prisma.transaction.findMany({ where: { userId } }),
        this.prisma.budget.findMany({ where: { userId } }),
        this.prisma.savingGoal.findMany({ where: { userId }, include: { histories: true } }),
        this.prisma.debt.findMany({ where: { userId } }),
        this.prisma.note.findMany({ where: { userId } }),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      user,
      settings,
      wallets,
      categories,
      transactions,
      budgets,
      savingGoals,
      debts,
      notes,
    };
  }
}

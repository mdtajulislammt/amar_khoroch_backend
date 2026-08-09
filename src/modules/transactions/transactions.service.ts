import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FilterTransactionDto } from './dto/filter-transaction.dto';
import { TransactionType } from '@prisma/client';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async getTransactions(userId: string, filterDto: FilterTransactionDto) {
    const page = filterDto.page || 1;
    const limit = filterDto.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (filterDto.type) {
      where.type = filterDto.type;
    }

    if (filterDto.walletId) {
      where.OR = [
        { walletId: filterDto.walletId },
        { toWalletId: filterDto.walletId },
      ];
    }

    if (filterDto.categoryId) {
      where.categoryId = filterDto.categoryId;
    }

    if (filterDto.search) {
      where.note = {
        contains: filterDto.search,
        mode: 'insensitive',
      };
    }

    if (filterDto.startDate || filterDto.endDate) {
      where.date = {};
      if (filterDto.startDate) where.date.gte = filterDto.startDate;
      if (filterDto.endDate) where.date.lte = filterDto.endDate;
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        select: {
          id: true,
          type: true,
          amount: true,
          categoryId: true,
          walletId: true,
          toWalletId: true,
          date: true,
          note: true,
          isRecurring: true,
          frequency: true,
          nextExecutionDate: true,
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions,
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  async getTransactionById(userId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
      select: {
        id: true,
        type: true,
        amount: true,
        categoryId: true,
        walletId: true,
        toWalletId: true,
        date: true,
        note: true,
        isRecurring: true,
        frequency: true,
        nextExecutionDate: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  async createTransaction(userId: string, dto: CreateTransactionDto) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Verify source wallet
      const wallet = await tx.wallet.findFirst({
        where: { id: dto.walletId, userId },
      });
      if (!wallet) {
        throw new NotFoundException('Source wallet not found');
      }

      // 2. Verify target wallet if TRANSFER
      let toWallet = null;
      if (dto.type === TransactionType.TRANSFER) {
        if (!dto.toWalletId) {
          throw new BadRequestException('Target wallet ID is required for transfers');
        }
        if (dto.walletId === dto.toWalletId) {
          throw new BadRequestException('Source and target wallets cannot be the same');
        }
        toWallet = await tx.wallet.findFirst({
          where: { id: dto.toWalletId, userId },
        });
        if (!toWallet) {
          throw new NotFoundException('Target wallet not found');
        }
      }

      // 3. Verify category if INCOME or EXPENSE
      if (dto.type === TransactionType.INCOME || dto.type === TransactionType.EXPENSE) {
        if (!dto.categoryId) {
          throw new BadRequestException('Category ID is required for income or expense transactions');
        }
        const category = await tx.category.findFirst({
          where: { id: dto.categoryId, userId },
        });
        if (!category) {
          throw new NotFoundException('Category not found');
        }
      }

      // 4. Update Wallet Balances
      if (dto.type === TransactionType.INCOME) {
        await tx.wallet.update({
          where: { id: dto.walletId },
          data: { balance: { increment: dto.amount } },
        });
      } else if (dto.type === TransactionType.EXPENSE) {
        await tx.wallet.update({
          where: { id: dto.walletId },
          data: { balance: { decrement: dto.amount } },
        });
      } else if (dto.type === TransactionType.TRANSFER) {
        await tx.wallet.update({
          where: { id: dto.walletId },
          data: { balance: { decrement: dto.amount } },
        });
        await tx.wallet.update({
          where: { id: dto.toWalletId },
          data: { balance: { increment: dto.amount } },
        });
      }

      // 5. Create Transaction
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: dto.type,
          amount: dto.amount,
          walletId: dto.walletId,
          toWalletId: dto.toWalletId || null,
          categoryId: dto.categoryId || null,
          date: dto.date,
          note: dto.note || null,
          isRecurring: dto.isRecurring || false,
          frequency: dto.isRecurring ? dto.frequency : null,
          nextExecutionDate: dto.isRecurring ? dto.nextExecutionDate : null,
        },
        select: {
          id: true,
          type: true,
          amount: true,
          categoryId: true,
          walletId: true,
          toWalletId: true,
          date: true,
          note: true,
          isRecurring: true,
          frequency: true,
          nextExecutionDate: true,
        },
      });

      // 6. Invalidate user caches
      await this.redisService.invalidateUserCache(userId);

      return transaction;
    });
  }

  async updateTransaction(userId: string, transactionId: string, dto: CreateTransactionDto) {
    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: { id: transactionId, userId },
      });

      if (!existing) {
        throw new NotFoundException('Transaction not found');
      }

      // 1. Revert previous wallet balance impact
      if (existing.type === TransactionType.INCOME) {
        await tx.wallet.update({
          where: { id: existing.walletId },
          data: { balance: { decrement: existing.amount } },
        });
      } else if (existing.type === TransactionType.EXPENSE) {
        await tx.wallet.update({
          where: { id: existing.walletId },
          data: { balance: { increment: existing.amount } },
        });
      } else if (existing.type === TransactionType.TRANSFER && existing.toWalletId) {
        await tx.wallet.update({
          where: { id: existing.walletId },
          data: { balance: { increment: existing.amount } },
        });
        await tx.wallet.update({
          where: { id: existing.toWalletId },
          data: { balance: { decrement: existing.amount } },
        });
      }

      // 2. Apply new wallet balance impact
      if (dto.type === TransactionType.INCOME) {
        await tx.wallet.update({
          where: { id: dto.walletId },
          data: { balance: { increment: dto.amount } },
        });
      } else if (dto.type === TransactionType.EXPENSE) {
        await tx.wallet.update({
          where: { id: dto.walletId },
          data: { balance: { decrement: dto.amount } },
        });
      } else if (dto.type === TransactionType.TRANSFER && dto.toWalletId) {
        await tx.wallet.update({
          where: { id: dto.walletId },
          data: { balance: { decrement: dto.amount } },
        });
        await tx.wallet.update({
          where: { id: dto.toWalletId },
          data: { balance: { increment: dto.amount } },
        });
      }

      // 3. Update the transaction record
      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          type: dto.type,
          amount: dto.amount,
          walletId: dto.walletId,
          toWalletId: dto.toWalletId || null,
          categoryId: dto.categoryId || null,
          date: dto.date,
          note: dto.note || null,
          isRecurring: dto.isRecurring || false,
          frequency: dto.isRecurring ? dto.frequency : null,
          nextExecutionDate: dto.isRecurring ? dto.nextExecutionDate : null,
        },
        select: {
          id: true,
          type: true,
          amount: true,
          categoryId: true,
          walletId: true,
          toWalletId: true,
          date: true,
          note: true,
          isRecurring: true,
          frequency: true,
          nextExecutionDate: true,
        },
      });

      await this.redisService.invalidateUserCache(userId);
      return updated;
    });
  }

  async deleteTransaction(userId: string, transactionId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findFirst({
        where: { id: transactionId, userId },
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      // Revert wallet balances
      if (transaction.type === TransactionType.INCOME) {
        await tx.wallet.update({
          where: { id: transaction.walletId },
          data: { balance: { decrement: transaction.amount } },
        });
      } else if (transaction.type === TransactionType.EXPENSE) {
        await tx.wallet.update({
          where: { id: transaction.walletId },
          data: { balance: { increment: transaction.amount } },
        });
      } else if (transaction.type === TransactionType.TRANSFER && transaction.toWalletId) {
        await tx.wallet.update({
          where: { id: transaction.walletId },
          data: { balance: { increment: transaction.amount } },
        });
        await tx.wallet.update({
          where: { id: transaction.toWalletId },
          data: { balance: { decrement: transaction.amount } },
        });
      }

      await tx.transaction.delete({
        where: { id: transactionId },
      });

      await this.redisService.invalidateUserCache(userId);

      return { message: 'Transaction deleted and wallet balance reverted successfully' };
    });
  }
}

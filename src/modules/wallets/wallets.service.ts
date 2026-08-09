import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';

@Injectable()
export class WalletsService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async getWallets(userId: string) {
    const cacheKey = `user:${userId}:wallets`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return cached;

    const wallets = await this.prisma.wallet.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        type: true,
        balance: true,
        icon: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    await this.redisService.set(cacheKey, wallets, 300);
    return wallets;
  }

  async createWallet(userId: string, dto: CreateWalletDto) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Create the wallet
      const wallet = await tx.wallet.create({
        data: {
          userId,
          name: dto.name,
          type: dto.type,
          balance: dto.balance,
          icon: dto.icon,
        },
        select: {
          id: true,
          name: true,
          type: true,
          balance: true,
          icon: true,
        },
      });

      // 2. If initial balance > 0, auto-create an INCOME transaction
      if (dto.balance && dto.balance > 0) {
        // Find or create a special "Initial Balance" income category
        let initCategory = await tx.category.findFirst({
          where: { userId, name: 'Initial Balance', type: 'INCOME' },
        });

        if (!initCategory) {
          initCategory = await tx.category.create({
            data: {
              userId,
              name: 'Initial Balance',
              type: 'INCOME',
              icon: 'Wallet',
              color: '#22c55e',
            },
          });
        }

        const today = new Date().toISOString().split('T')[0];
        await tx.transaction.create({
          data: {
            userId,
            type: 'INCOME',
            amount: dto.balance,
            walletId: wallet.id,
            categoryId: initCategory.id,
            date: today,
            note: `${dto.name} - প্রাথমিক ব্যালেন্স`,
            isRecurring: false,
          },
        });
      }

      await this.redisService.del(`user:${userId}:wallets`);
      await this.redisService.del(`user:${userId}:summary`);
      await this.redisService.del(`user:${userId}:transactions`);
      await this.redisService.del(`user:${userId}:categories`);

      return wallet;
    });
  }

  async updateWallet(userId: string, walletId: string, dto: UpdateWalletDto) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const updated = await this.prisma.wallet.update({
      where: { id: walletId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.type && { type: dto.type }),
        ...(dto.icon && { icon: dto.icon }),
      },
      select: {
        id: true,
        name: true,
        type: true,
        balance: true,
        icon: true,
      },
    });

    await this.redisService.del(`user:${userId}:wallets`);
    return updated;
  }

  async deleteWallet(userId: string, walletId: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    await this.prisma.wallet.delete({
      where: { id: walletId },
    });

    await this.redisService.del(`user:${userId}:wallets`);
    await this.redisService.del(`user:${userId}:summary`);
    return { message: 'Wallet deleted successfully' };
  }
}

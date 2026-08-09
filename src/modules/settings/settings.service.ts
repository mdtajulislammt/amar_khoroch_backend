import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { PinDto } from './dto/pin.dto';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async getSettings(userId: string) {
    const cacheKey = `user:${userId}:settings`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return cached;

    let settings = await this.prisma.appSetting.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.appSetting.create({
        data: {
          userId,
          language: 'en',
          autoLockHours: 1,
        },
      });
    }

    const data = {
      isPinEnabled: settings.isPinEnabled,
      autoLockHours: settings.autoLockHours ?? 1,
      activeWalletId: settings.activeWalletId,
      language: settings.language,
      hasPin: !!settings.pinCodeHash,
    };

    await this.redisService.set(cacheKey, data, 300);
    return data;
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    const existing = await this.prisma.appSetting.findUnique({ where: { userId } });
    if (dto.isPinEnabled === true && (!existing || !existing.pinCodeHash)) {
      throw new BadRequestException('Please set a security PIN first');
    }

    const settings = await this.prisma.appSetting.upsert({
      where: { userId },
      update: {
        ...(dto.activeWalletId !== undefined && { activeWalletId: dto.activeWalletId }),
        ...(dto.language && { language: dto.language }),
        ...(dto.isPinEnabled !== undefined && { isPinEnabled: dto.isPinEnabled }),
        ...(dto.autoLockHours !== undefined && { autoLockHours: dto.autoLockHours }),
      },
      create: {
        userId,
        activeWalletId: dto.activeWalletId || null,
        language: dto.language || 'en',
        isPinEnabled: dto.isPinEnabled || false,
        autoLockHours: dto.autoLockHours ?? 1,
      },
    });

    await this.redisService.del(`user:${userId}:settings`);
    return {
      isPinEnabled: settings.isPinEnabled,
      autoLockHours: settings.autoLockHours ?? 1,
      activeWalletId: settings.activeWalletId,
      language: settings.language,
      hasPin: !!settings.pinCodeHash,
    };
  }

  async setPin(userId: string, dto: PinDto) {
    const pinCodeHash = await bcrypt.hash(dto.pinCode, 10);

    await this.prisma.appSetting.upsert({
      where: { userId },
      update: {
        isPinEnabled: true,
        pinCodeHash,
      },
      create: {
        userId,
        isPinEnabled: true,
        pinCodeHash,
      },
    });

    await this.redisService.del(`user:${userId}:settings`);
    return { isPinEnabled: true, message: 'Security PIN set successfully' };
  }

  async verifyPin(userId: string, dto: PinDto) {
    const settings = await this.prisma.appSetting.findUnique({
      where: { userId },
    });

    if (!settings || !settings.isPinEnabled || !settings.pinCodeHash) {
      throw new BadRequestException('Security PIN is not enabled');
    }

    const isMatch = await bcrypt.compare(dto.pinCode, settings.pinCodeHash);
    if (!isMatch) {
      throw new BadRequestException('Invalid PIN code');
    }

    return { verified: true };
  }
}

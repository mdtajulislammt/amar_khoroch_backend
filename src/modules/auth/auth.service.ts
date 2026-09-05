import { Injectable, BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email.toLowerCase(),
          passwordHash,
          phone: dto.phone || null,
          currency: dto.currency || 'BDT (৳)',
          role: 'Pro Member',
        },
      });

      // Default App Settings & Default Wallet
      const defaultWallet = await tx.wallet.create({
        data: {
          userId: newUser.id,
          name: 'Cash Wallet',
          type: 'CASH',
          balance: 0,
          icon: 'Wallet',
        },
      });

      await tx.appSetting.create({
        data: {
          userId: newUser.id,
          activeWalletId: defaultWallet.id,
          language: 'en',
        },
      });

      // Default Categories
      await tx.category.createMany({
        data: [
          { userId: newUser.id, name: 'Food & Dining', type: 'EXPENSE', icon: 'UtensilsCrossed', color: '#38bdf8' },
          { userId: newUser.id, name: 'Transportation', type: 'EXPENSE', icon: 'Bus', color: '#f59e0b' },
          { userId: newUser.id, name: 'Salary & Income', type: 'INCOME', icon: 'Briefcase', color: '#22c55e' },
        ],
      });

      return newUser;
    });

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        currency: user.currency,
        joinedDate: user.createdAt.toISOString().split('T')[0],
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        currency: user.currency,
        joinedDate: user.createdAt.toISOString().split('T')[0],
      },
    };
  }

  async googleAuth(dto: GoogleAuthDto) {
    const email = dto.email.toLowerCase();
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      // Register new user via Google
      const randomPasswordHash = await bcrypt.hash(Math.random().toString(36), 10);
      user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            name: dto.name,
            email,
            passwordHash: randomPasswordHash,
            avatar: dto.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
            role: 'Pro Member',
          },
        });

        // Default App Settings & Default Wallet
        const defaultWallet = await tx.wallet.create({
          data: {
            userId: newUser.id,
            name: 'Cash Wallet',
            type: 'CASH',
            balance: 0,
            icon: 'Wallet',
          },
        });

        await tx.appSetting.create({
          data: {
            userId: newUser.id,
            activeWalletId: defaultWallet.id,
            language: 'en',
          },
        });

        // Default Categories
        await tx.category.createMany({
          data: [
            { userId: newUser.id, name: 'Food & Dining', type: 'EXPENSE', icon: 'UtensilsCrossed', color: '#38bdf8' },
            { userId: newUser.id, name: 'Transportation', type: 'EXPENSE', icon: 'Bus', color: '#f59e0b' },
            { userId: newUser.id, name: 'Salary & Income', type: 'INCOME', icon: 'Briefcase', color: '#22c55e' },
          ],
        });

        return newUser;
      });
    } else if (dto.avatar && !user.avatar) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { avatar: dto.avatar },
      });
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return {
      token,
      isNewUser,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        currency: user.currency,
        joinedDate: user.createdAt.toISOString().split('T')[0],
      },
    };
  }

  async getProfile(userId: string) {
    const cacheKey = `user:${userId}:profile`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
        currency: true,
        bio: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User profile not found');
    }

    const profileData = {
      ...user,
      joinedDate: user.createdAt.toISOString().split('T')[0],
    };

    await this.redisService.set(cacheKey, profileData, 300);
    return profileData;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.role && { role: dto.role }),
        ...(dto.avatar !== undefined && { avatar: dto.avatar }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
        currency: true,
        bio: true,
        createdAt: true,
      },
    });

    await this.redisService.del(`user:${userId}:profile`);
    return {
      ...updatedUser,
      joinedDate: updatedUser.createdAt.toISOString().split('T')[0],
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Current password does not match');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return { message: 'Password updated successfully' };
  }
}

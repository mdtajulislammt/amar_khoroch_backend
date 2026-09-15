import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { Role, AccountStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminUserQueryDto } from './dto/admin-query.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  /**
   * Admin-Only Authentication Gateway
   */
  async adminLogin(dto: AdminLoginDto) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    if (user.role !== Role.ADMIN && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Access denied. Administrator privileges required.');
    }

    if (user.status === AccountStatus.BANNED || user.status === AccountStatus.SUSPENDED) {
      throw new ForbiddenException('Admin account has been suspended or banned.');
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    // Record login audit
    await this.logAdminAction(user.id, 'ADMIN_LOGIN', user.id, 'USER', {
      email: user.email,
      role: user.role,
    });

    return {
      token,
      admin: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    };
  }

  /**
   * Overview Metrics / KPIs for the Admin Command Center
   */
  async getOverviewMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalUsers,
      newUsersToday,
      newUsersThisWeek,
      totalWallets,
      totalTransactions,
      totalSavingGoals,
      incomeAggregate,
      expenseAggregate,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
      this.prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.wallet.count(),
      this.prisma.transaction.count(),
      this.prisma.savingGoal.count(),
      this.prisma.transaction.aggregate({
        where: { type: 'INCOME' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { type: 'EXPENSE' },
        _sum: { amount: true },
      }),
    ]);

    const totalIncomeVolume = incomeAggregate._sum.amount || 0;
    const totalExpenseVolume = expenseAggregate._sum.amount || 0;
    const totalProcessedVolume = totalIncomeVolume + totalExpenseVolume;

    return {
      totalUsers,
      newUsersToday,
      newUsersThisWeek,
      totalWallets,
      totalTransactions,
      totalSavingGoals,
      totalIncomeVolume,
      totalExpenseVolume,
      totalProcessedVolume,
    };
  }

  /**
   * Analytics Charts (User growth over 30 days & Monthly cashflow aggregate)
   */
  async getAnalyticsCharts() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch user registrations for the last 30 days
    const recentUsers = await this.prisma.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group users by day
    const userGrowthMap: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().split('T')[0];
      userGrowthMap[key] = 0;
    }
    recentUsers.forEach((u) => {
      const day = u.createdAt.toISOString().split('T')[0];
      if (userGrowthMap[day] !== undefined) {
        userGrowthMap[day]++;
      }
    });

    const userGrowthTrend = Object.entries(userGrowthMap).map(([date, count]) => ({
      date,
      count,
    }));

    // Platform-wide category distribution
    const categoriesWithCount = await this.prisma.category.groupBy({
      by: ['name', 'type', 'color'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 8,
    });

    return {
      userGrowthTrend,
      topCategories: categoriesWithCount.map((c) => ({
        name: c.name,
        type: c.type,
        color: c.color,
        count: c._count.id,
      })),
    };
  }

  /**
   * User Directory with search, filters, pagination and counts
   */
  async getUsers(query: AdminUserQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (query.search) {
      const search = query.search.trim();
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.role) {
      whereClause.role = query.role as Role;
    }

    if (query.status) {
      whereClause.status = query.status as AccountStatus;
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where: whereClause }),
      this.prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          currency: true,
          avatar: true,
          createdAt: true,
          _count: {
            select: {
              wallets: true,
              transactions: true,
              savingGoals: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      users: users.map((u) => ({
        ...u,
        joinedDate: u.createdAt.toISOString().split('T')[0],
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Specific User Deep-Dive Detail
   */
  async getUserDetails(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        appSetting: true,
        wallets: {
          select: { id: true, name: true, type: true, balance: true, icon: true },
        },
        _count: {
          select: {
            transactions: true,
            budgets: true,
            savingGoals: true,
            debts: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Update User Account Status (ACTIVE, SUSPENDED, BANNED)
   */
  async updateUserStatus(adminId: string, targetUserId: string, status: AccountStatus) {
    if (adminId === targetUserId) {
      throw new BadRequestException('You cannot change your own account status.');
    }

    const user = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { status },
      select: { id: true, email: true, status: true, role: true },
    });

    // Invalidate user profile cache
    await this.redisService.del(`user:${targetUserId}:profile`);

    await this.logAdminAction(adminId, 'UPDATE_USER_STATUS', targetUserId, 'USER', {
      newStatus: status,
      targetEmail: user.email,
    });

    return user;
  }

  /**
   * Update User Role (USER, MODERATOR, ADMIN)
   */
  async updateUserRole(adminId: string, targetUserId: string, role: Role) {
    if (adminId === targetUserId) {
      throw new BadRequestException('You cannot change your own role.');
    }

    const user = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role },
      select: { id: true, email: true, role: true },
    });

    await this.redisService.del(`user:${targetUserId}:profile`);

    await this.logAdminAction(adminId, 'UPDATE_USER_ROLE', targetUserId, 'USER', {
      newRole: role,
      targetEmail: user.email,
    });

    return user;
  }

  /**
   * Reset User PIN Lock
   */
  async resetUserPin(adminId: string, targetUserId: string) {
    await this.prisma.appSetting.update({
      where: { userId: targetUserId },
      data: {
        isPinEnabled: false,
        pinCodeHash: null,
      },
    });

    await this.logAdminAction(adminId, 'RESET_USER_PIN', targetUserId, 'USER', {});
    return { message: 'User security PIN has been cleared and disabled successfully.' };
  }

  /**
   * Permanent User Deletion (Wipe out all user data)
   */
  async deleteUser(adminId: string, targetUserId: string) {
    if (adminId === targetUserId) {
      throw new BadRequestException('You cannot delete your own admin account.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.delete({ where: { id: targetUserId } });
    await this.redisService.del(`user:${targetUserId}:profile`);

    await this.logAdminAction(adminId, 'DELETE_USER', targetUserId, 'USER', {
      deletedEmail: user.email,
    });

    return { message: `User ${user.email} and all associated records permanently removed.` };
  }

  /**
   * Redis Cache Purge
   */
  async purgeRedisCache(adminId: string) {
    await this.redisService.flushAll();
    await this.logAdminAction(adminId, 'PURGE_CACHE', null, 'SYSTEM', {});
    return { message: 'Redis cache flushed completely.' };
  }

  /**
   * Announcements Management
   */
  async getAnnouncements() {
    return this.prisma.systemAnnouncement.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActivePublicAnnouncements() {
    const now = new Date();
    return this.prisma.systemAnnouncement.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAnnouncement(adminId: string, dto: CreateAnnouncementDto) {
    const announcement = await this.prisma.systemAnnouncement.create({
      data: {
        title: dto.title,
        message: dto.message,
        type: dto.type || 'INFO',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdById: adminId,
      },
    });

    await this.logAdminAction(adminId, 'CREATE_ANNOUNCEMENT', announcement.id, 'ANNOUNCEMENT', {
      title: announcement.title,
    });

    return announcement;
  }

  async toggleAnnouncement(adminId: string, id: string) {
    const item = await this.prisma.systemAnnouncement.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Announcement not found');

    const updated = await this.prisma.systemAnnouncement.update({
      where: { id },
      data: { isActive: !item.isActive },
    });

    await this.logAdminAction(adminId, 'TOGGLE_ANNOUNCEMENT', id, 'ANNOUNCEMENT', {
      isActive: updated.isActive,
    });

    return updated;
  }

  async deleteAnnouncement(adminId: string, id: string) {
    await this.prisma.systemAnnouncement.delete({ where: { id } });
    await this.logAdminAction(adminId, 'DELETE_ANNOUNCEMENT', id, 'ANNOUNCEMENT', {});
    return { message: 'Announcement deleted successfully.' };
  }

  /**
   * Audit Logs
   */
  async getAuditLogs(limit = 50) {
    return this.prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Helper to write audit logs
   */
  private async logAdminAction(
    adminId: string,
    action: string,
    targetId?: string | null,
    targetType?: string | null,
    details?: any,
  ) {
    try {
      await this.prisma.adminAuditLog.create({
        data: {
          adminId,
          action,
          targetId: targetId || null,
          targetType: targetType || null,
          details: details || {},
        },
      });
    } catch (e) {
      // Non-blocking log failure
      console.error('Failed to write audit log:', e);
    }
  }
}

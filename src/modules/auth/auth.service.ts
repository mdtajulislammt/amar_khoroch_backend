import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { AuthMailService } from './mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redisService: RedisService,
    private mailService: AuthMailService,
  ) {}

  private async initializeUserDefaults(tx: any, userId: string) {
    // Default Wallets
    const defaultWallet = await tx.wallet.create({
      data: {
        userId,
        name: 'Cash Wallet',
        type: 'CASH',
        balance: 5000,
        icon: 'Wallet',
      },
    });

    await tx.wallet.createMany({
      data: [
        {
          userId,
          name: 'Bank Account',
          type: 'BANK',
          balance: 25000,
          icon: 'Landmark',
        },
        {
          userId,
          name: 'bKash',
          type: 'MOBILE_BANKING',
          balance: 3500,
          icon: 'Smartphone',
        },
      ],
    });

    // Default App Settings
    await tx.appSetting.create({
      data: {
        userId,
        activeWalletId: defaultWallet.id,
        language: 'bn',
      },
    });

    // Default Categories
    await tx.category.createMany({
      data: [
        { userId, name: 'Food & Dining', type: 'EXPENSE', icon: 'UtensilsCrossed', color: '#38bdf8' },
        { userId, name: 'House Rent', type: 'EXPENSE', icon: 'Home', color: '#6366f1' },
        { userId, name: 'Transportation', type: 'EXPENSE', icon: 'Bus', color: '#0ea5e9' },
        { userId, name: 'Shopping', type: 'EXPENSE', icon: 'ShoppingBag', color: '#8b5cf6' },
        { userId, name: 'Bills & Utilities', type: 'EXPENSE', icon: 'Receipt', color: '#64748b' },
        { userId, name: 'Salary & Income', type: 'INCOME', icon: 'Briefcase', color: '#22c55e' },
        { userId, name: 'Freelancing', type: 'INCOME', icon: 'Laptop', color: '#14b8a6' },
      ],
    });

    return defaultWallet;
  }

  /**
   * Auto-provisions and returns demo user session
   */
  private async handleDemoLogin() {
    const demoEmail = 'tajul.islam@example.com';
    let user = await this.prisma.user.findUnique({
      where: { email: demoEmail },
    });

    if (!user) {
      const passwordHash = await bcrypt.hash('demo1234', 10);
      user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            name: 'MD Tajul Islam (Demo)',
            email: demoEmail,
            passwordHash,
            phone: '+8801991311505',
            role: 'USER',
            isEmailVerified: true,
            currency: 'BDT (৳)',
          },
        });

        const defaultWallet = await this.initializeUserDefaults(tx, newUser.id);

        // Add sample demo transactions
        const catSalary = await tx.category.findFirst({
          where: { userId: newUser.id, name: 'Salary & Income' },
        });
        const catFood = await tx.category.findFirst({
          where: { userId: newUser.id, name: 'Food & Dining' },
        });

        if (catSalary) {
          await tx.transaction.create({
            data: {
              userId: newUser.id,
              walletId: defaultWallet.id,
              categoryId: catSalary.id,
              type: 'INCOME',
              amount: 45000,
              date: new Date().toISOString().split("T")[0],
              note: 'Monthly Demo Salary',
            },
          });
        }

        if (catFood) {
          await tx.transaction.create({
            data: {
              userId: newUser.id,
              walletId: defaultWallet.id,
              categoryId: catFood.id,
              type: 'EXPENSE',
              amount: 1250,
              date: new Date().toISOString().split("T")[0],
              note: 'Weekly Grocery Shopping',
            },
          });
        }

        return newUser;
      });
    } else if (!user.isEmailVerified) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { isEmailVerified: true },
      });
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

  async register(dto: RegisterDto) {
    const cleanEmail = dto.email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      if (!existingUser.isEmailVerified) {
        // User exists but has not verified yet -> generate new OTP and re-prompt verification
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await this.redisService.set(`verify:otp:${cleanEmail}`, otp, 600);
        await this.mailService.sendVerificationOtpEmail(cleanEmail, existingUser.name, otp);

        return {
          requiresVerification: true,
          email: cleanEmail,
          message: 'আপনার এই ইমেইলে পূর্বের অ্যাকাউন্টটি এখনো ভেরিফাই করা হয়নি। আপনার ইনবক্সে নতুন ৬-সংখ্যার কোড পাঠানো হয়েছে।',
        };
      }
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: dto.name,
          email: cleanEmail,
          passwordHash,
          phone: dto.phone || null,
          currency: dto.currency || 'BDT (৳)',
          role: 'USER',
          isEmailVerified: false,
        },
      });

      await this.initializeUserDefaults(tx, newUser.id);
      return newUser;
    });

    // Generate 6-digit OTP and store in Redis with 10-minute expiry
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await this.redisService.set(`verify:otp:${cleanEmail}`, otp, 600);

    // Send email with OTP code
    await this.mailService.sendVerificationOtpEmail(cleanEmail, user.name, otp);

    return {
      requiresVerification: true,
      email: cleanEmail,
      message: 'অ্যাকাউন্ট তৈরি হয়েছে। লগইন নিশ্চিত করতে আপনার ইমেইলে পাঠানো ৬-সংখ্যার ভেরিফিকেশন কোডটি প্রদান করুন।',
    };
  }

  async verifyEmailOtp(email: string, otp: string) {
    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = String(otp || '').trim();

    const storedOtp = await this.redisService.get<string>(`verify:otp:${cleanEmail}`);

    if (!storedOtp || String(storedOtp).trim() !== cleanOtp) {
      throw new BadRequestException('ভেরিফিকেশন কোডটি সঠিক নয় অথবা কোডের মেয়াদ শেষ হয়ে গেছে।');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      throw new NotFoundException('ব্যবহারকারী পাওয়া যায়নি');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true },
    });

    await this.redisService.del(`verify:otp:${cleanEmail}`);

    const token = this.jwtService.sign({ sub: updatedUser.id, email: updatedUser.email });

    return {
      success: true,
      message: 'ইমেইল ভেরিফিকেশন সফল হয়েছে! স্বাগতম।',
      token,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        avatar: updatedUser.avatar,
        currency: updatedUser.currency,
        joinedDate: updatedUser.createdAt.toISOString().split('T')[0],
      },
    };
  }

  async resendVerificationOtp(email: string) {
    const cleanEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      throw new NotFoundException('এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('আপনার ইমেইল ইতিমধ্যেই ভেরিফাইড। অনুগ্রহ করে সরাসরি লগইন করুন।');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await this.redisService.set(`verify:otp:${cleanEmail}`, otp, 600);
    await this.mailService.sendVerificationOtpEmail(cleanEmail, user.name, otp);

    return {
      success: true,
      message: 'আপনার ইমেইলে নতুন ৬-সংখ্যার ভেরিফিকেশন কোড পাঠানো হয়েছে।',
    };
  }

  async login(dto: LoginDto) {
    const cleanEmail = dto.email.toLowerCase().trim();

    // Check for demo account
    if (cleanEmail === 'tajul.islam@example.com' && dto.password === 'demo1234') {
      return this.handleDemoLogin();
    }

    const user = await this.prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Ensure email is verified
    if (!user.isEmailVerified && user.role === 'USER') {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      await this.redisService.set(`verify:otp:${cleanEmail}`, otp, 600);
      await this.mailService.sendVerificationOtpEmail(cleanEmail, user.name, otp);

      throw new UnauthorizedException({
        requiresVerification: true,
        email: cleanEmail,
        message: 'আপনার ইমেইল ভেরিফাই করা হয়নি। আপনার ইনবক্সে ৬-সংখ্যার কোড পাঠানো হয়েছে, অনুগ্রহ করে ভেরিফিকেশন সম্পন্ন করুন।',
      });
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
      const randomPasswordHash = await bcrypt.hash(Math.random().toString(36), 10);
      user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            name: dto.name,
            email,
            passwordHash: randomPasswordHash,
            avatar: dto.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
            role: 'USER',
            isEmailVerified: true,
          },
        });

        await this.initializeUserDefaults(tx, newUser.id);
        return newUser;
      });
    } else if (dto.avatar && !user.avatar) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { avatar: dto.avatar, isEmailVerified: true },
      });
    } else if (!user.isEmailVerified) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { isEmailVerified: true },
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

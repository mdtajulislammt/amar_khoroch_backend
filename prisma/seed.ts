import { PrismaClient, Role, AccountStatus, WalletType, CategoryType, TransactionType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting E-Khoroch Database Seeding...');

  // -------------------------------------------------------------
  // 1. SUPER ADMIN SEED
  // -------------------------------------------------------------
  const adminEmail = 'dev.tajulislam505@gmail.com';
  let admin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!admin) {
    console.log(`Creating new Super Admin: ${adminEmail}`);
    const adminPasswordHash = await bcrypt.hash('Admin@12345', 10);
    admin = await prisma.user.create({
      data: {
        name: 'MD Tajul Islam',
        email: adminEmail,
        passwordHash: adminPasswordHash,
        phone: '01991311505',
        role: Role.SUPER_ADMIN,
        status: AccountStatus.ACTIVE,
        isEmailVerified: true,
        currency: 'BDT (৳)',
      },
    });
  } else {
    console.log(`Super Admin exists: ${adminEmail}. Ensuring roles & verification...`);
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: {
        role: Role.SUPER_ADMIN,
        status: AccountStatus.ACTIVE,
        isEmailVerified: true,
      },
    });
  }

  // Ensure Admin Default Wallet & Settings
  let adminWallet = await prisma.wallet.findFirst({
    where: { userId: admin.id },
  });
  if (!adminWallet) {
    adminWallet = await prisma.wallet.create({
      data: {
        userId: admin.id,
        name: 'Main Wallet',
        type: WalletType.CASH,
        balance: 0,
        icon: 'Wallet',
      },
    });
  }

  await prisma.appSetting.upsert({
    where: { userId: admin.id },
    update: { activeWalletId: adminWallet.id, language: 'bn' },
    create: { userId: admin.id, activeWalletId: adminWallet.id, language: 'bn' },
  });

  console.log('✅ Super Admin seed completed.');

  // -------------------------------------------------------------
  // 2. DEMO USER ACCOUNT SEED
  // -------------------------------------------------------------
  const demoEmail = 'tajul.islam@example.com';
  let demoUser = await prisma.user.findUnique({
    where: { email: demoEmail },
  });

  const demoPasswordHash = await bcrypt.hash('demo1234', 10);

  if (!demoUser) {
    console.log(`Creating Demo User: ${demoEmail}`);
    demoUser = await prisma.user.create({
      data: {
        name: 'MD Tajul Islam (Demo)',
        email: demoEmail,
        passwordHash: demoPasswordHash,
        phone: '+8801991311505',
        role: Role.USER,
        status: AccountStatus.ACTIVE,
        isEmailVerified: true,
        currency: 'BDT (৳)',
      },
    });
  } else {
    console.log(`Updating Demo User credentials: ${demoEmail}`);
    demoUser = await prisma.user.update({
      where: { id: demoUser.id },
      data: {
        name: 'MD Tajul Islam (Demo)',
        passwordHash: demoPasswordHash,
        role: Role.USER,
        status: AccountStatus.ACTIVE,
        isEmailVerified: true,
      },
    });
  }

  // Demo Wallets
  let demoCash = await prisma.wallet.findFirst({
    where: { userId: demoUser.id, name: 'Cash Wallet' },
  });
  if (!demoCash) {
    demoCash = await prisma.wallet.create({
      data: {
        userId: demoUser.id,
        name: 'Cash Wallet',
        type: WalletType.CASH,
        balance: 5000,
        icon: 'Wallet',
      },
    });
  } else {
    demoCash = await prisma.wallet.update({
      where: { id: demoCash.id },
      data: { balance: 5000 },
    });
  }

  let demoBank = await prisma.wallet.findFirst({
    where: { userId: demoUser.id, name: 'Bank Account' },
  });
  if (!demoBank) {
    demoBank = await prisma.wallet.create({
      data: {
        userId: demoUser.id,
        name: 'Bank Account',
        type: WalletType.BANK,
        balance: 25000,
        icon: 'Landmark',
      },
    });
  } else {
    demoBank = await prisma.wallet.update({
      where: { id: demoBank.id },
      data: { balance: 25000 },
    });
  }

  let demoBkash = await prisma.wallet.findFirst({
    where: { userId: demoUser.id, name: 'bKash' },
  });
  if (!demoBkash) {
    demoBkash = await prisma.wallet.create({
      data: {
        userId: demoUser.id,
        name: 'bKash',
        type: WalletType.MOBILE_BANKING,
        balance: 3500,
        icon: 'Smartphone',
      },
    });
  } else {
    demoBkash = await prisma.wallet.update({
      where: { id: demoBkash.id },
      data: { balance: 3500 },
    });
  }

  await prisma.appSetting.upsert({
    where: { userId: demoUser.id },
    update: { activeWalletId: demoCash.id, language: 'bn' },
    create: { userId: demoUser.id, activeWalletId: demoCash.id, language: 'bn' },
  });

  // Demo Categories
  const demoCategoriesData = [
    { name: 'Salary & Income', type: CategoryType.INCOME, icon: 'Briefcase', color: '#22c55e' },
    { name: 'Freelancing', type: CategoryType.INCOME, icon: 'Laptop', color: '#14b8a6' },
    { name: 'Food & Dining', type: CategoryType.EXPENSE, icon: 'UtensilsCrossed', color: '#38bdf8' },
    { name: 'House Rent', type: CategoryType.EXPENSE, icon: 'Home', color: '#6366f1' },
    { name: 'Transportation', type: CategoryType.EXPENSE, icon: 'Bus', color: '#0ea5e9' },
    { name: 'Shopping', type: CategoryType.EXPENSE, icon: 'ShoppingBag', color: '#8b5cf6' },
    { name: 'Bills & Utilities', type: CategoryType.EXPENSE, icon: 'Receipt', color: '#64748b' },
  ];

  for (const cat of demoCategoriesData) {
    const existingCat = await prisma.category.findFirst({
      where: { userId: demoUser.id, name: cat.name },
    });
    if (!existingCat) {
      await prisma.category.create({
        data: {
          userId: demoUser.id,
          name: cat.name,
          type: cat.type,
          icon: cat.icon,
          color: cat.color,
        },
      });
    }
  }

  // Demo Sample Transactions
  const todayStr = new Date().toISOString().split('T')[0];
  const catSalary = await prisma.category.findFirst({
    where: { userId: demoUser.id, name: 'Salary & Income' },
  });
  const catFood = await prisma.category.findFirst({
    where: { userId: demoUser.id, name: 'Food & Dining' },
  });
  const catShopping = await prisma.category.findFirst({
    where: { userId: demoUser.id, name: 'Shopping' },
  });

  const txCount = await prisma.transaction.count({
    where: { userId: demoUser.id },
  });

  if (txCount === 0) {
    if (catSalary) {
      await prisma.transaction.create({
        data: {
          userId: demoUser.id,
          walletId: demoBank.id,
          categoryId: catSalary.id,
          type: TransactionType.INCOME,
          amount: 45000,
          date: todayStr,
          note: 'Monthly Demo Salary',
        },
      });
    }

    if (catFood) {
      await prisma.transaction.create({
        data: {
          userId: demoUser.id,
          walletId: demoCash.id,
          categoryId: catFood.id,
          type: TransactionType.EXPENSE,
          amount: 1250,
          date: todayStr,
          note: 'Weekly Grocery Shopping',
        },
      });
    }

    if (catShopping) {
      await prisma.transaction.create({
        data: {
          userId: demoUser.id,
          walletId: demoBkash.id,
          categoryId: catShopping.id,
          type: TransactionType.EXPENSE,
          amount: 3500,
          date: todayStr,
          note: 'Online Shopping Order',
        },
      });
    }
    console.log('✅ Demo Transactions created.');
  }

  console.log('✅ Demo Account seed completed.');

  // -------------------------------------------------------------
  // 3. GLOBAL CATEGORY TEMPLATES SEED
  // -------------------------------------------------------------
  const globalTemplates = [
    { name: 'Food & Dining', nameBn: 'খাবার ও রেস্তোরাঁ', type: CategoryType.EXPENSE, icon: 'UtensilsCrossed', color: '#38bdf8' },
    { name: 'House Rent', nameBn: 'বাসা ভাড়া', type: CategoryType.EXPENSE, icon: 'Home', color: '#6366f1' },
    { name: 'Transportation', nameBn: 'যাতায়াত ও ভাড়া', type: CategoryType.EXPENSE, icon: 'Bus', color: '#0ea5e9' },
    { name: 'Shopping', nameBn: 'কেনাকাটা', type: CategoryType.EXPENSE, icon: 'ShoppingBag', color: '#8b5cf6' },
    { name: 'Bills & Utilities', nameBn: 'ইউটিলিটি ও বিল', type: CategoryType.EXPENSE, icon: 'Receipt', color: '#64748b' },
    { name: 'Healthcare', nameBn: 'চিকিৎসা ও ওষুধ', type: CategoryType.EXPENSE, icon: 'HeartPulse', color: '#ef4444' },
    { name: 'Salary & Income', nameBn: 'বেতন ও মূল আয়', type: CategoryType.INCOME, icon: 'Briefcase', color: '#22c55e' },
    { name: 'Freelancing', nameBn: 'ফ্রিল্যান্সিং', type: CategoryType.INCOME, icon: 'Laptop', color: '#14b8a6' },
    { name: 'Investments', nameBn: 'বিনিয়োগ ও লভ্যাংশ', type: CategoryType.INCOME, icon: 'TrendingUp', color: '#eab308' },
  ];

  for (const template of globalTemplates) {
    const exists = await prisma.globalCategoryTemplate.findFirst({
      where: { name: template.name },
    });
    if (!exists) {
      await prisma.globalCategoryTemplate.create({
        data: template,
      });
    }
  }
  console.log('✅ Global Category Templates seed completed.');

  console.log('🎉 All Database Seeds finished successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

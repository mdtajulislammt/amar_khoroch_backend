import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async getCategories(userId: string) {
    const cacheKey = `user:${userId}:categories`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return cached;

    const categories = await this.prisma.category.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        type: true,
        icon: true,
        color: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    await this.redisService.set(cacheKey, categories, 300);
    return categories;
  }

  async createCategory(userId: string, dto: CreateCategoryDto) {
    const category = await this.prisma.category.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        icon: dto.icon,
        color: dto.color,
      },
      select: {
        id: true,
        name: true,
        type: true,
        icon: true,
        color: true,
      },
    });

    await this.redisService.del(`user:${userId}:categories`);
    return category;
  }

  async updateCategory(userId: string, categoryId: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const updated = await this.prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.type && { type: dto.type }),
        ...(dto.icon && { icon: dto.icon }),
        ...(dto.color && { color: dto.color }),
      },
      select: {
        id: true,
        name: true,
        type: true,
        icon: true,
        color: true,
      },
    });

    await this.redisService.del(`user:${userId}:categories`);
    return updated;
  }

  async deleteCategory(userId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await this.prisma.category.delete({
      where: { id: categoryId },
    });

    await this.redisService.del(`user:${userId}:categories`);
    return { message: 'Category deleted successfully' };
  }
}

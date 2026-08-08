import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Categories')
@ApiBearerAuth()
@Controller('api/v1/categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Get All Categories', description: 'Retrieve all income and expense categories created by the user.' })
  @ApiResponse({ status: 200, description: 'Categories retrieved successfully' })
  async getCategories(@CurrentUser('id') userId: string) {
    const data = await this.categoriesService.getCategories(userId);
    return {
      message: 'Categories retrieved successfully',
      data,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create Category', description: 'Create a new custom income or expense category.' })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  async createCategory(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    const data = await this.categoriesService.createCategory(userId, dto);
    return {
      message: 'Category created successfully',
      data,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update Category', description: 'Update a category name, type, icon, or color by ID.' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async updateCategory(
    @CurrentUser('id') userId: string,
    @Param('id') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const data = await this.categoriesService.updateCategory(userId, categoryId, dto);
    return {
      message: 'Category updated successfully',
      data,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Category', description: 'Delete a category by ID.' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async deleteCategory(
    @CurrentUser('id') userId: string,
    @Param('id') categoryId: string,
  ) {
    const data = await this.categoriesService.deleteCategory(userId, categoryId);
    return {
      message: data.message,
      data: null,
    };
  }
}

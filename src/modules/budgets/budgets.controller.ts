import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Budgets')
@ApiBearerAuth()
@Controller('api/v1/budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @ApiOperation({ summary: 'Get Budgets Overview', description: 'Retrieve all category budgets along with real-time period expense calculation.' })
  @ApiResponse({ status: 200, description: 'Budgets retrieved successfully' })
  async getBudgets(@CurrentUser('id') userId: string) {
    const data = await this.budgetsService.getBudgets(userId);
    return {
      message: 'Budgets retrieved successfully',
      data,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Set/Create Budget', description: 'Set a spending limit budget for a category.' })
  @ApiResponse({ status: 201, description: 'Budget created successfully' })
  async createBudget(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBudgetDto,
  ) {
    const data = await this.budgetsService.createBudget(userId, dto);
    return {
      message: 'Budget created successfully',
      data,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Budget', description: 'Delete a budget limit by ID.' })
  @ApiParam({ name: 'id', description: 'Budget ID' })
  @ApiResponse({ status: 200, description: 'Budget deleted successfully' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  async deleteBudget(
    @CurrentUser('id') userId: string,
    @Param('id') budgetId: string,
  ) {
    const data = await this.budgetsService.deleteBudget(userId, budgetId);
    return {
      message: data.message,
      data: null,
    };
  }
}

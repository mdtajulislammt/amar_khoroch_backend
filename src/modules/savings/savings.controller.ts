import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SavingsService } from './savings.service';
import { CreateSavingGoalDto } from './dto/create-saving-goal.dto';
import { UpdateSavingGoalDto } from './dto/update-saving-goal.dto';
import { DepositSavingDto } from './dto/deposit-saving.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Savings Goals')
@ApiBearerAuth()
@Controller('api/v1/savings')
@UseGuards(JwtAuthGuard)
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  // ─── Static routes FIRST (before parameterized :id routes) ───────────────

  @Get()
  @ApiOperation({ summary: 'Get Saving Goals', description: 'Retrieve all savings goals created by the user.' })
  @ApiResponse({ status: 200, description: 'Saving goals retrieved successfully' })
  async getSavingGoals(@CurrentUser('id') userId: string) {
    const data = await this.savingsService.getSavingGoals(userId);
    return {
      message: 'Saving goals retrieved successfully',
      data,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create Saving Goal', description: 'Create a new savings goal target.' })
  @ApiResponse({ status: 201, description: 'Saving goal created successfully' })
  async createSavingGoal(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSavingGoalDto,
  ) {
    const data = await this.savingsService.createSavingGoal(userId, dto);
    return {
      message: 'Saving goal created successfully',
      data,
    };
  }

  // IMPORTANT: 'history' static routes must come BEFORE ':id' parameterized routes
  // Otherwise NestJS will match 'history' as an :id parameter value

  @Get('history')
  @ApiOperation({ summary: 'Get Saving Deposit History', description: 'Retrieve deposit history for savings goals.' })
  @ApiQuery({ name: 'savingId', required: false, description: 'Filter history by specific goal ID' })
  @ApiResponse({ status: 200, description: 'Saving history retrieved successfully' })
  async getSavingHistory(
    @CurrentUser('id') userId: string,
    @Query('savingId') savingId?: string,
  ) {
    const data = await this.savingsService.getSavingHistory(userId, savingId);
    return {
      message: 'Saving history retrieved successfully',
      data,
    };
  }

  @Delete('history/:historyId')
  @ApiOperation({ summary: 'Delete Saving History Item', description: 'Delete a deposit history item and refund balance to wallet.' })
  @ApiParam({ name: 'historyId', description: 'Saving History Item ID' })
  @ApiResponse({ status: 200, description: 'Deposit record deleted successfully' })
  async deleteSavingHistory(
    @CurrentUser('id') userId: string,
    @Param('historyId') historyId: string,
  ) {
    const data = await this.savingsService.deleteSavingHistory(userId, historyId);
    return {
      message: data.message,
      data: null,
    };
  }

  // ─── Parameterized :id routes AFTER static routes ─────────────────────────

  @Put(':id')
  @ApiOperation({ summary: 'Update Saving Goal', description: 'Update goal name, target amount, or target date by ID.' })
  @ApiParam({ name: 'id', description: 'Saving Goal ID' })
  @ApiResponse({ status: 200, description: 'Saving goal updated successfully' })
  @ApiResponse({ status: 404, description: 'Saving goal not found' })
  async updateSavingGoal(
    @CurrentUser('id') userId: string,
    @Param('id') goalId: string,
    @Body() dto: UpdateSavingGoalDto,
  ) {
    const data = await this.savingsService.updateSavingGoal(userId, goalId, dto);
    return {
      message: 'Saving goal updated successfully',
      data,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Saving Goal', description: 'Delete a savings goal by ID.' })
  @ApiParam({ name: 'id', description: 'Saving Goal ID' })
  @ApiResponse({ status: 200, description: 'Saving goal deleted successfully' })
  async deleteSavingGoal(
    @CurrentUser('id') userId: string,
    @Param('id') goalId: string,
  ) {
    const data = await this.savingsService.deleteSavingGoal(userId, goalId);
    return {
      message: data.message,
      data: null,
    };
  }

  @Post(':id/deposit')
  @ApiOperation({ summary: 'Deposit into Saving Goal', description: 'Deduct money from an active wallet and deposit into savings target.' })
  @ApiParam({ name: 'id', description: 'Saving Goal ID' })
  @ApiResponse({ status: 200, description: 'Deposit successful' })
  @ApiResponse({ status: 404, description: 'Savings goal or wallet not found' })
  async depositSavingGoal(
    @CurrentUser('id') userId: string,
    @Param('id') goalId: string,
    @Body() dto: DepositSavingDto,
  ) {
    const data = await this.savingsService.depositSavingGoal(userId, goalId, dto);
    return {
      message: 'Deposit successful',
      data: {
        id: data.goal.id,
        goalName: data.goal.goalName,
        targetAmount: data.goal.targetAmount,
        currentAmount: data.goal.currentAmount,
        targetDate: data.goal.targetDate,
      },
    };
  }
}

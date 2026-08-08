import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CategoryType } from '@prisma/client';

@ApiTags('Reports & Analytics')
@ApiBearerAuth()
@Controller('api/v1/reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get Dashboard Summary Metrics', description: 'Fetch high-level overview metrics (total balance, total income, total expense, net savings, active wallets count). Cached in Redis.' })
  @ApiResponse({ status: 200, description: 'Dashboard summary metrics retrieved successfully' })
  async getSummary(@CurrentUser('id') userId: string) {
    const data = await this.reportsService.getSummary(userId);
    return {
      message: 'Dashboard summary metrics retrieved successfully',
      data,
    };
  }

  @Get('cashflow')
  @ApiOperation({ summary: 'Get Cashflow Chart Analytics', description: 'Fetch income vs expense cashflow chart data over time.' })
  @ApiQuery({ name: 'period', enum: ['monthly', 'weekly'], required: false, description: 'Cashflow aggregation period' })
  @ApiResponse({ status: 200, description: 'Cashflow data retrieved successfully' })
  async getCashflow(
    @CurrentUser('id') userId: string,
    @Query('period') period?: 'monthly' | 'weekly',
  ) {
    const data = await this.reportsService.getCashflow(userId, period);
    return {
      message: 'Cashflow data retrieved successfully',
      data,
    };
  }

  @Get('category-breakdown')
  @ApiOperation({ summary: 'Get Category Breakdown Analytics', description: 'Fetch expense or income distribution by categories with percentages.' })
  @ApiQuery({ name: 'type', enum: CategoryType, required: false, description: 'EXPENSE or INCOME breakdown' })
  @ApiResponse({ status: 200, description: 'Category breakdown retrieved successfully' })
  async getCategoryBreakdown(
    @CurrentUser('id') userId: string,
    @Query('type') type?: CategoryType,
  ) {
    const data = await this.reportsService.getCategoryBreakdown(userId, type);
    return {
      message: 'Category breakdown retrieved successfully',
      data,
    };
  }

  @Get('export')
  @ApiOperation({ summary: 'Export All User Data', description: 'Generate a complete JSON data dump backup for the user.' })
  @ApiResponse({ status: 200, description: 'User data exported successfully' })
  async exportUserData(@CurrentUser('id') userId: string) {
    const data = await this.reportsService.exportUserData(userId);
    return {
      message: 'User data exported successfully',
      data,
    };
  }
}

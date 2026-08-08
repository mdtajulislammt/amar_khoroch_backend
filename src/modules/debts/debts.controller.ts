import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { DebtsService } from './debts.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Debts & Loans')
@ApiBearerAuth()
@Controller('api/v1/debts')
@UseGuards(JwtAuthGuard)
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Get()
  @ApiOperation({ summary: 'Get All Debts', description: 'Retrieve all receivables and payables tracked by the user.' })
  @ApiResponse({ status: 200, description: 'Debts retrieved successfully' })
  async getDebts(@CurrentUser('id') userId: string) {
    const data = await this.debtsService.getDebts(userId);
    return {
      message: 'Debts retrieved successfully',
      data,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Add New Debt', description: 'Create a new debt/loan record (given or taken).' })
  @ApiResponse({ status: 201, description: 'Debt record created successfully' })
  async createDebt(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDebtDto,
  ) {
    const data = await this.debtsService.createDebt(userId, dto);
    return {
      message: 'Debt record created successfully',
      data,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update Debt Record', description: 'Update debt person name, amount, or due date by ID.' })
  @ApiParam({ name: 'id', description: 'Debt Record ID' })
  @ApiResponse({ status: 200, description: 'Debt record updated successfully' })
  @ApiResponse({ status: 404, description: 'Debt record not found' })
  async updateDebt(
    @CurrentUser('id') userId: string,
    @Param('id') debtId: string,
    @Body() dto: UpdateDebtDto,
  ) {
    const data = await this.debtsService.updateDebt(userId, debtId, dto);
    return {
      message: 'Debt record updated successfully',
      data,
    };
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle Debt Status', description: 'Toggle cleared status (true/false) for a debt record.' })
  @ApiParam({ name: 'id', description: 'Debt Record ID' })
  @ApiResponse({ status: 200, description: 'Debt status updated' })
  async toggleDebt(
    @CurrentUser('id') userId: string,
    @Param('id') debtId: string,
  ) {
    const data = await this.debtsService.toggleDebt(userId, debtId);
    return {
      message: 'Debt status updated',
      data,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Debt Record', description: 'Delete a debt record by ID.' })
  @ApiParam({ name: 'id', description: 'Debt Record ID' })
  @ApiResponse({ status: 200, description: 'Debt record deleted successfully' })
  async deleteDebt(
    @CurrentUser('id') userId: string,
    @Param('id') debtId: string,
  ) {
    const data = await this.debtsService.deleteDebt(userId, debtId);
    return {
      message: data.message,
      data: null,
    };
  }
}

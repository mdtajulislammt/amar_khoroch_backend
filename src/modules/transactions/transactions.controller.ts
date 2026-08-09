import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FilterTransactionDto } from './dto/filter-transaction.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('api/v1/transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get Transactions List', description: 'Retrieve financial transactions with optional search, filtering, and pagination.' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved successfully' })
  async getTransactions(
    @CurrentUser('id') userId: string,
    @Query() filterDto: FilterTransactionDto,
  ) {
    const res = await this.transactionsService.getTransactions(userId, filterDto);
    return {
      message: 'Transactions retrieved successfully',
      data: res.data,
      pagination: res.pagination,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Transaction by ID', description: 'Fetch single transaction record by ID.' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ status: 200, description: 'Transaction retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransactionById(
    @CurrentUser('id') userId: string,
    @Param('id') transactionId: string,
  ) {
    const data = await this.transactionsService.getTransactionById(userId, transactionId);
    return {
      message: 'Transaction retrieved successfully',
      data,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Add Transaction (Quick Entry)', description: 'Record a new income, expense, or transfer transaction.' })
  @ApiResponse({ status: 201, description: 'Transaction added successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async createTransaction(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    const data = await this.transactionsService.createTransaction(userId, dto);
    return {
      message: 'Transaction added successfully',
      data,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update Transaction', description: 'Update an existing transaction record.' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ status: 200, description: 'Transaction updated successfully' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async updateTransaction(
    @CurrentUser('id') userId: string,
    @Param('id') transactionId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    const data = await this.transactionsService.updateTransaction(userId, transactionId, dto);
    return {
      message: 'Transaction updated successfully',
      data,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Transaction', description: 'Delete a transaction and automatically revert associated wallet balances.' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ status: 200, description: 'Transaction deleted successfully' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async deleteTransaction(
    @CurrentUser('id') userId: string,
    @Param('id') transactionId: string,
  ) {
    const data = await this.transactionsService.deleteTransaction(userId, transactionId);
    return {
      message: data.message,
      data: null,
    };
  }
}

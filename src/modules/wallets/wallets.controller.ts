import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Wallets')
@ApiBearerAuth()
@Controller('api/v1/wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  @ApiOperation({ summary: 'Get All Wallets', description: 'Retrieve all accounts/wallets owned by the user.' })
  @ApiResponse({ status: 200, description: 'Wallets retrieved successfully' })
  async getWallets(@CurrentUser('id') userId: string) {
    const data = await this.walletsService.getWallets(userId);
    return {
      message: 'Wallets retrieved successfully',
      data,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create New Wallet', description: 'Create a new cash, bank, or mobile banking wallet.' })
  @ApiResponse({ status: 201, description: 'Wallet created successfully' })
  async createWallet(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateWalletDto,
  ) {
    const data = await this.walletsService.createWallet(userId, dto);
    return {
      message: 'Wallet created successfully',
      data,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update Wallet Details', description: 'Update wallet name, type, or icon by ID.' })
  @ApiParam({ name: 'id', description: 'Wallet ID' })
  @ApiResponse({ status: 200, description: 'Wallet updated successfully' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async updateWallet(
    @CurrentUser('id') userId: string,
    @Param('id') walletId: string,
    @Body() dto: UpdateWalletDto,
  ) {
    const data = await this.walletsService.updateWallet(userId, walletId, dto);
    return {
      message: 'Wallet updated successfully',
      data,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Wallet', description: 'Delete a wallet by ID.' })
  @ApiParam({ name: 'id', description: 'Wallet ID' })
  @ApiResponse({ status: 200, description: 'Wallet deleted successfully' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async deleteWallet(
    @CurrentUser('id') userId: string,
    @Param('id') walletId: string,
  ) {
    const data = await this.walletsService.deleteWallet(userId, walletId);
    return {
      message: data.message,
      data: null,
    };
  }
}

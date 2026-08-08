import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { PinDto } from './dto/pin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Settings & Security')
@ApiBearerAuth()
@Controller('api/v1/settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get User App Settings', description: 'Fetch user configuration preferences like language, PIN status, and active wallet.' })
  @ApiResponse({ status: 200, description: 'Settings retrieved successfully' })
  async getSettings(@CurrentUser('id') userId: string) {
    const data = await this.settingsService.getSettings(userId);
    return {
      message: 'Settings retrieved successfully',
      data,
    };
  }

  @Put()
  @ApiOperation({ summary: 'Update App Settings', description: 'Update active wallet ID or app interface language.' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  async updateSettings(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    const data = await this.settingsService.updateSettings(userId, dto);
    return {
      message: 'Settings updated successfully',
      data,
    };
  }

  @Post('pin/set')
  @ApiOperation({ summary: 'Set or Enable Security PIN', description: 'Set a 4-digit security PIN for app lock screen gate.' })
  @ApiResponse({ status: 200, description: 'Security PIN set successfully' })
  async setPin(
    @CurrentUser('id') userId: string,
    @Body() dto: PinDto,
  ) {
    const data = await this.settingsService.setPin(userId, dto);
    return {
      message: data.message,
      data: { isPinEnabled: data.isPinEnabled },
    };
  }

  @Post('pin/verify')
  @ApiOperation({ summary: 'Verify Security PIN', description: 'Verify user 4-digit security PIN.' })
  @ApiResponse({ status: 200, description: 'PIN verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid PIN code' })
  async verifyPin(
    @CurrentUser('id') userId: string,
    @Body() dto: PinDto,
  ) {
    const data = await this.settingsService.verifyPin(userId, dto);
    return {
      message: 'PIN verified successfully',
      data,
    };
  }
}

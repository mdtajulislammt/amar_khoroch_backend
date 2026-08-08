import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('User Profile')
@ApiBearerAuth()
@Controller('api/v1/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get Current User Profile', description: 'Fetch profile information of the authenticated user.' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser('id') userId: string) {
    const data = await this.authService.getProfile(userId);
    return {
      message: 'Profile retrieved successfully',
      data,
    };
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update User Profile', description: 'Update current user profile information.' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const data = await this.authService.updateProfile(userId, dto);
    return {
      message: 'Profile updated successfully',
      data,
    };
  }

  @Put('change-password')
  @ApiOperation({ summary: 'Change Password', description: 'Change current user password.' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Current password does not match' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    const result = await this.authService.changePassword(userId, dto);
    return {
      message: result.message,
      data: null,
    };
  }
}

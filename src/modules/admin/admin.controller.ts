import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import { BackupService } from './backup.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminUserQueryDto } from './dto/admin-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Admin')
@Controller('api/v1/admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly backupService: BackupService,
  ) {}

  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin Portal Login', description: 'Authenticate admin credentials and obtain JWT token.' })
  @ApiResponse({ status: 200, description: 'Admin authentication successful' })
  @ApiResponse({ status: 401, description: 'Invalid admin credentials' })
  @ApiResponse({ status: 403, description: 'Access denied: Requires administrator privileges' })
  async adminLogin(@Body() dto: AdminLoginDto) {
    const data = await this.adminService.adminLogin(dto);
    return {
      message: 'Admin authentication successful',
      data,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('analytics/overview')
  @ApiOperation({ summary: 'Platform Overview KPIs', description: 'Get top-level metrics for admin command center.' })
  async getOverview() {
    const data = await this.adminService.getOverviewMetrics();
    return {
      message: 'Overview metrics retrieved successfully',
      data,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('analytics/charts')
  @ApiOperation({ summary: 'Analytics Charts Data', description: 'User growth and category aggregates for charts.' })
  async getCharts() {
    const data = await this.adminService.getAnalyticsCharts();
    return {
      message: 'Analytics charts data retrieved successfully',
      data,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('users')
  @ApiOperation({ summary: 'User Directory', description: 'List, filter, and search platform users.' })
  async getUsers(@Query() query: AdminUserQueryDto) {
    const data = await this.adminService.getUsers(query);
    return {
      message: 'Users retrieved successfully',
      data: data.users,
      pagination: data.pagination,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('users/:id')
  @ApiOperation({ summary: 'User Details', description: 'Fetch full profile and relations of a single user.' })
  async getUserDetails(@Param('id') id: string) {
    const data = await this.adminService.getUserDetails(id);
    return {
      message: 'User details retrieved successfully',
      data,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Update User Status', description: 'Ban, suspend, or activate a user account.' })
  async updateUserStatus(
    @CurrentUser('id') adminId: string,
    @Param('id') targetUserId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    const data = await this.adminService.updateUserStatus(adminId, targetUserId, dto.status);
    return {
      message: `User status updated to ${dto.status}`,
      data,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Update User Role', description: 'Promote or demote user (Super Admin only).' })
  async updateUserRole(
    @CurrentUser('id') adminId: string,
    @Param('id') targetUserId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    const data = await this.adminService.updateUserRole(adminId, targetUserId, dto.role);
    return {
      message: `User role updated to ${dto.role}`,
      data,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('users/:id/reset-pin')
  @ApiOperation({ summary: 'Reset Security PIN', description: 'Clear forgotten 4-digit PIN for a user.' })
  async resetUserPin(
    @CurrentUser('id') adminId: string,
    @Param('id') targetUserId: string,
  ) {
    const data = await this.adminService.resetUserPin(adminId, targetUserId);
    return {
      message: data.message,
      data: null,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete User Permanently', description: 'Permanent deletion of user and data (Super Admin only).' })
  async deleteUser(
    @CurrentUser('id') adminId: string,
    @Param('id') targetUserId: string,
  ) {
    const data = await this.adminService.deleteUser(adminId, targetUserId);
    return {
      message: data.message,
      data: null,
    };
  }

  // --- Database Backup Vault Endpoints ---

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('backup/logs')
  @ApiOperation({ summary: 'Database Backup Logs', description: 'Fetch past backup execution history.' })
  async getBackupLogs() {
    const data = await this.backupService.getBackupLogs();
    return {
      message: 'Backup logs retrieved successfully',
      data,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('backup/trigger-and-email')
  @ApiOperation({ summary: 'Trigger Instant Backup & Email', description: 'Creates live database pg_dump, zips it, and emails to dev.tajulislam505@gmail.com.' })
  async triggerBackupAndEmail(@CurrentUser('email') adminEmail: string) {
    const result = await this.backupService.triggerDatabaseBackup(`ADMIN_UI (${adminEmail})`);
    return {
      message: result.message,
      data: result.data,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('backup/download/:filename')
  @ApiOperation({ summary: 'Download Backup ZIP', description: 'Download a specific backup zip file from server.' })
  async downloadBackup(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = this.backupService.getBackupFilePath(filename);
    if (!filePath) {
      throw new NotFoundException('Backup file not found on server');
    }
    return res.download(filePath, filename);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('backup/restore')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Restore Database Backup', description: 'Upload a .zip or .sql backup file to restore database state.' })
  async restoreBackup(
    @UploadedFile() file: any,
    @CurrentUser('email') adminEmail: string,
  ) {
    if (!file) {
      throw new BadRequestException('Please provide a backup file (.zip or .sql) to restore');
    }
    const result = await this.backupService.restoreDatabaseBackup(file, adminEmail);
    return {
      success: true,
      message: result.message,
      data: result.data,
    };
  }


  // --- Cache & Telemetry ---

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('cache/clear')
  @ApiOperation({ summary: 'Purge Redis Cache', description: 'Flushes cached report and analytics keys.' })
  async purgeCache(@CurrentUser('id') adminId: string) {
    const data = await this.adminService.purgeRedisCache(adminId);
    return {
      message: data.message,
      data: null,
    };
  }

  // --- Announcements ---

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('announcements')
  @ApiOperation({ summary: 'List All Announcements', description: 'Fetch all announcements for admin.' })
  async getAnnouncements() {
    const data = await this.adminService.getAnnouncements();
    return {
      message: 'Announcements retrieved successfully',
      data,
    };
  }

  @Public()
  @Get('announcements/public')
  @ApiOperation({ summary: 'Active Public Announcements', description: 'Fetch active banner notices for regular users.' })
  async getPublicAnnouncements(
    @Query('userId') userId?: string,
    @Query('email') email?: string,
  ) {
    const data = await this.adminService.getActivePublicAnnouncements(userId, email);
    return {
      message: 'Active announcements retrieved successfully',
      data,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('announcements')
  @ApiOperation({ summary: 'Create Announcement', description: 'Publish a new in-app banner announcement.' })
  async createAnnouncement(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreateAnnouncementDto,
  ) {
    const data = await this.adminService.createAnnouncement(adminId, dto);
    return {
      message: 'Announcement published successfully',
      data,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('announcements/:id/toggle')
  @ApiOperation({ summary: 'Toggle Announcement Active State', description: 'Enable or disable an announcement.' })
  async toggleAnnouncement(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
  ) {
    const data = await this.adminService.toggleAnnouncement(adminId, id);
    return {
      message: 'Announcement status toggled',
      data,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Delete('announcements/:id')
  @ApiOperation({ summary: 'Delete Announcement', description: 'Permanently remove an announcement.' })
  async deleteAnnouncement(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
  ) {
    const data = await this.adminService.deleteAnnouncement(adminId, id);
    return {
      message: data.message,
      data: null,
    };
  }

  // --- Audit Logs ---

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('audit-logs')
  @ApiOperation({ summary: 'Admin Audit Logs', description: 'View audit trail of administrative actions.' })
  async getAuditLogs() {
    const data = await this.adminService.getAuditLogs();
    return {
      message: 'Audit logs retrieved successfully',
      data,
    };
  }
}

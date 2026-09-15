import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { BackupService } from './backup.service';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService, BackupService, RolesGuard],
  exports: [AdminService, BackupService],
})
export class AdminModule {}

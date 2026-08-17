import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { Admin } from '../entities/admin.entity';
import { Document } from '../entities/document.entity';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { Permission } from '../entities/permission.entity';
import { Reminder } from '../entities/reminder.entity';
import { Report } from '../entities/report.entity';
import { User } from '../entities/user.entity';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminManagementController } from './admin-management.controller';
import { AdminManagementService } from './admin-management.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Admin,
      Permission,
      User,
      Document,
      Report,
      Reminder,
      GstFilingPeriod,
    ]),
    AuditModule,
  ],
  controllers: [AdminManagementController, AdminDashboardController],
  providers: [AdminManagementService, AdminDashboardService],
  exports: [AdminManagementService],
})
export class AdminManagementModule {}

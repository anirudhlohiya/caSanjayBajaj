import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ComplianceTask,
  GstFilingPeriod,
  Reminder,
  Report,
  User,
} from '../entities';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SchedulingModule } from '../schedule/scheduling.module';
import { ShareLinksModule } from '../share-links/share-links.module';
import { ComplianceTasksService } from './compliance-tasks.service';
import { ComplianceTasksController } from './compliance-tasks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ComplianceTask,
      User,
      GstFilingPeriod,
      Report,
      Reminder,
    ]),
    SchedulingModule,
    NotificationsModule,
    AuditModule,
    ShareLinksModule,
  ],
  controllers: [ComplianceTasksController],
  providers: [ComplianceTasksService],
  exports: [ComplianceTasksService],
})
export class ComplianceTasksModule {}

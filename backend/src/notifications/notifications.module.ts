import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportNotification } from '../entities/report-notification.entity';
import { NotificationsService } from './notifications.service';
import { ReportNotificationsController } from './report-notifications.controller';
import { ReportNotificationsService } from './report-notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReportNotification])],
  controllers: [ReportNotificationsController],
  providers: [NotificationsService, ReportNotificationsService],
  exports: [NotificationsService, ReportNotificationsService],
})
export class NotificationsModule {}

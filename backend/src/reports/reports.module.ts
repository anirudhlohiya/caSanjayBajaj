import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { Report } from '../entities/report.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ShareLinksModule } from '../share-links/share-links.module';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, GstFilingPeriod]),
    StorageModule,
    NotificationsModule,
    ShareLinksModule,
    UsersModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}

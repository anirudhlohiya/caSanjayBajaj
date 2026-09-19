import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportRequest } from '../entities/report-request.entity';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { ReportsModule } from '../reports/reports.module';
import { AuditModule } from '../audit/audit.module';
import { ReportRequestsController } from './report-requests.controller';
import { ReportRequestsService } from './report-requests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReportRequest, GstFilingPeriod]),
    ReportsModule,
    AuditModule,
  ],
  controllers: [ReportRequestsController],
  providers: [ReportRequestsService],
  exports: [ReportRequestsService],
})
export class ReportRequestsModule {}

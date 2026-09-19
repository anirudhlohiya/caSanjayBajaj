import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { SchedulingModule } from '../schedule/scheduling.module';
import { ComplianceTasksModule } from '../compliance-tasks/compliance-tasks.module';
import { PeriodsController } from './periods.controller';
import { PeriodsService } from './periods.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GstFilingPeriod]),
    SchedulingModule,
    ComplianceTasksModule,
  ],
  controllers: [PeriodsController],
  providers: [PeriodsService],
  exports: [PeriodsService],
})
export class PeriodsModule {}

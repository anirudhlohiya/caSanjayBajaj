import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceTask } from '../entities';
import { ComplianceTasksService } from './compliance-tasks.service';
import { ComplianceTasksController } from './compliance-tasks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ComplianceTask])],
  controllers: [ComplianceTasksController],
  providers: [ComplianceTasksService],
  exports: [ComplianceTasksService],
})
export class ComplianceTasksModule {}

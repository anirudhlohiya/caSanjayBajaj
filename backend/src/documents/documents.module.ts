import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceTasksModule } from '../compliance-tasks/compliance-tasks.module';
import { Document } from '../entities/document.entity';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, GstFilingPeriod]),
    StorageModule,
    UsersModule,
    ComplianceTasksModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}

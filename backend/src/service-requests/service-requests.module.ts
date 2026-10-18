import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { ServiceRequest, User } from '../entities';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequestsService } from './service-requests.service';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceRequest, User]), AuditModule],
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsService],
  exports: [ServiceRequestsService],
})
export class ServiceRequestsModule {}

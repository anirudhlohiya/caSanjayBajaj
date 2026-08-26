import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from '../entities/service.entity';
import {
  ServicesController,
  AdminServicesController,
} from './services-offered.controller';
import { ServicesOfferedService } from './services-offered.service';

@Module({
  imports: [TypeOrmModule.forFeature([Service])],
  controllers: [ServicesController, AdminServicesController],
  providers: [ServicesOfferedService],
  exports: [ServicesOfferedService],
})
export class ServicesOfferedModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSetting } from '../entities/app-setting.entity';
import { Service } from '../entities/service.entity';
import { TicketsModule } from '../tickets/tickets.module';
import {
  AdminServicesController,
  FirmController,
  ServicesController,
} from './services-offered.controller';
import { ServicesOfferedService } from './services-offered.service';

@Module({
  imports: [TypeOrmModule.forFeature([Service, AppSetting]), TicketsModule],
  controllers: [ServicesController, AdminServicesController, FirmController],
  providers: [ServicesOfferedService],
  exports: [ServicesOfferedService],
})
export class ServicesOfferedModule {}

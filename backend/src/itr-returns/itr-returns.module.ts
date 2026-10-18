import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { ItrReturn, User } from '../entities';
import { StorageModule } from '../storage/storage.module';
import { ItrReturnsController } from './itr-returns.controller';
import { ItrReturnsService } from './itr-returns.service';

@Module({
  imports: [TypeOrmModule.forFeature([ItrReturn, User]), StorageModule, AuditModule],
  controllers: [ItrReturnsController],
  providers: [ItrReturnsService],
  exports: [ItrReturnsService],
})
export class ItrReturnsModule {}

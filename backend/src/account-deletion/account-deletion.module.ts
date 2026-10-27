import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { User } from '../entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ServicesOfferedModule } from '../services-offered/services-offered.module';
import { StorageModule } from '../storage/storage.module';
import { AccountDeletionController } from './account-deletion.controller';
import { AccountDeletionService } from './account-deletion.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    AuditModule,
    StorageModule,
    NotificationsModule,
    ServicesOfferedModule,
  ],
  controllers: [AccountDeletionController],
  providers: [AccountDeletionService],
  exports: [AccountDeletionService],
})
export class AccountDeletionModule {}

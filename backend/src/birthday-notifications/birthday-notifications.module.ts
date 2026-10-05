import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BirthdayNotificationsService } from './birthday-notifications.service';
import { User } from '../entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), NotificationsModule, UsersModule],
  providers: [BirthdayNotificationsService],
  exports: [BirthdayNotificationsService],
})
export class BirthdayNotificationsModule {}

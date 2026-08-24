import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PeriodsModule } from './periods/periods.module';
import { DocumentsModule } from './documents/documents.module';
import { ReportsModule } from './reports/reports.module';
import { RemindersModule } from './reminders/reminders.module';
import { AdminManagementModule } from './admin-management/admin-management.module';
import { AuditModule } from './audit/audit.module';
import { StorageModule } from './storage/storage.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AppVersionModule } from './app-version/app-version.module';
import { WebsiteModule } from './website/website.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    AuthModule,
    UsersModule,
    PeriodsModule,
    DocumentsModule,
    ReportsModule,
    RemindersModule,
    AdminManagementModule,
    AuditModule,
    StorageModule,
    NotificationsModule,
    AppVersionModule,
    WebsiteModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

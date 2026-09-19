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
import { ServicesOfferedModule } from './services-offered/services-offered.module';
import { TicketsModule } from './tickets/tickets.module';
import { RentAgreementsModule } from './rent-agreements/rent-agreements.module';
import { SnsModule } from './sns/sns.module';
import { ComplianceTasksModule } from './compliance-tasks/compliance-tasks.module';
import { SchedulingModule } from './schedule/scheduling.module';
import { CertificatesModule } from './certificates/certificates.module';
import { HealthController } from './health.controller';
import { ReportRequestsModule } from './report-requests/report-requests.module';
import { ShareLinksModule } from './share-links/share-links.module';

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
    ServicesOfferedModule,
    TicketsModule,
    RentAgreementsModule,
    SnsModule,
    ComplianceTasksModule,
    SchedulingModule,
    CertificatesModule,
    ShareLinksModule,
    ReportRequestsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

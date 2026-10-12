import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportNotification } from '../entities/report-notification.entity';
import { User } from '../entities/user.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ReportNotificationsController } from './report-notifications.controller';
import { ReportNotificationsService } from './report-notifications.service';
import { WhatsappAiService } from './whatsapp-ai.service';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ReportNotification, User])],
  controllers: [
    ReportNotificationsController,
    NotificationsController,
    WhatsappWebhookController,
  ],
  providers: [
    NotificationsService,
    ReportNotificationsService,
    WhatsappAiService,
  ],
  exports: [
    NotificationsService,
    ReportNotificationsService,
    WhatsappAiService,
  ],
})
export class NotificationsModule {}

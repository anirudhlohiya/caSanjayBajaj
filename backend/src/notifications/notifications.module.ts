import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportNotification } from '../entities/report-notification.entity';
import { User } from '../entities/user.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ReportNotificationsController } from './report-notifications.controller';
import { ReportNotificationsService } from './report-notifications.service';
import { WhatsappAiService } from './whatsapp-ai.service';
import { WhatsappMediaService } from './whatsapp-media.service';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappChatsModule } from '../whatsapp-chats/whatsapp-chats.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReportNotification, User]),
    forwardRef(() => WhatsappChatsModule),
  ],
  controllers: [
    ReportNotificationsController,
    NotificationsController,
    WhatsappWebhookController,
  ],
  providers: [
    NotificationsService,
    ReportNotificationsService,
    WhatsappAiService,
    WhatsappMediaService,
  ],
  exports: [
    NotificationsService,
    ReportNotificationsService,
    WhatsappAiService,
    WhatsappMediaService,
  ],
})
export class NotificationsModule {}

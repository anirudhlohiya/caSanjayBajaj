import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ReportNotification,
  User,
  ClientCertificate,
  ItrReturn,
  Report,
  ComplianceTask,
  Document,
  GstFilingPeriod,
} from '../entities';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ReportNotificationsController } from './report-notifications.controller';
import { ReportNotificationsService } from './report-notifications.service';
import { WhatsappAiService } from './whatsapp-ai.service';
import { WhatsappMediaService } from './whatsapp-media.service';
import { WhatsappKnowledgeBaseService } from './whatsapp-knowledge-base.service';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappChatsModule } from '../whatsapp-chats/whatsapp-chats.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReportNotification,
      User,
      ClientCertificate,
      ItrReturn,
      Report,
      ComplianceTask,
      Document,
      GstFilingPeriod,
    ]),
    forwardRef(() => WhatsappChatsModule),
    StorageModule,
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
    WhatsappKnowledgeBaseService,
  ],
  exports: [
    NotificationsService,
    ReportNotificationsService,
    WhatsappAiService,
    WhatsappMediaService,
    WhatsappKnowledgeBaseService,
  ],
})
export class NotificationsModule {}

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
  DeviceToken,
} from '../entities';
import { ClientAlertsService } from './client-alerts.service';
import { WhatsappTranscriptionService } from './whatsapp-transcription.service';
import { WhatsappUploadsService } from './whatsapp-uploads.service';
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
      DeviceToken,
    ]),
    forwardRef(() => WhatsappChatsModule),
    StorageModule,
  ],
  controllers: [ReportNotificationsController, WhatsappWebhookController],
  providers: [
    NotificationsService,
    ReportNotificationsService,
    WhatsappAiService,
    WhatsappMediaService,
    WhatsappKnowledgeBaseService,
    WhatsappTranscriptionService,
    WhatsappUploadsService,
    ClientAlertsService,
  ],
  exports: [
    ClientAlertsService,
    NotificationsService,
    ReportNotificationsService,
    WhatsappAiService,
    WhatsappMediaService,
    WhatsappKnowledgeBaseService,
  ],
})
export class NotificationsModule {}

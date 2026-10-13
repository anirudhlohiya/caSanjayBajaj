import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { WhatsappConversation } from '../entities/whatsapp-conversation.entity';
import { WhatsappMessage } from '../entities/whatsapp-message.entity';
import { User } from '../entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { WhatsappChatsService } from './whatsapp-chats.service';
import { WhatsappChatsController } from './whatsapp-chats.controller';
import { WhatsappEventsService } from './whatsapp-events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WhatsappConversation, WhatsappMessage, User]),
    JwtModule.register({}),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [WhatsappChatsController],
  providers: [WhatsappChatsService, WhatsappEventsService],
  exports: [WhatsappChatsService, WhatsappEventsService],
})
export class WhatsappChatsModule {}

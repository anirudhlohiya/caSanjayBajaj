import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { TicketAttachment } from '../entities/ticket-attachment.entity';
import { StorageModule } from '../storage/storage.module';
import {
  ClientTicketsController,
  AdminTicketsController,
} from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, TicketMessage, TicketAttachment]),
    StorageModule,
  ],
  controllers: [ClientTicketsController, AdminTicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}

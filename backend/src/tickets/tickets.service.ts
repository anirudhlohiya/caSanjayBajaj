import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  paginate,
  PaginatedResult,
  PaginationQueryDto,
} from '../common/dto/pagination';
import { StorageService } from '../storage/storage.service';
import { NotificationsService, isPushSubscription } from '../notifications/notifications.service';
import { ReportNotificationsService } from '../notifications/report-notifications.service';
import { UsersService } from '../users/users.service';
import {
  Ticket,
  TicketStatus,
} from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { TicketAttachment } from '../entities/ticket-attachment.entity';
import {
  CreateTicketDto,
  CreateTicketMessageDto,
  TicketAttachmentUploadDto,
} from './dto/ticket.dto';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly tickets: Repository<Ticket>,
    @InjectRepository(TicketMessage)
    private readonly messages: Repository<TicketMessage>,
    @InjectRepository(TicketAttachment)
    private readonly attachments: Repository<TicketAttachment>,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly reportNotifications: ReportNotificationsService,
    private readonly usersService: UsersService,
  ) {}

  // --- Client methods ---

  async listForUser(
    userId: string,
    query: PaginationQueryDto & { status?: string },
  ): Promise<PaginatedResult<Ticket>> {
    const { page, pageSize, status } = query;
    const where: any = { user_id: userId };
    if (status) where.status = status;
    const [items, total] = await this.tickets.findAndCount({
      where,
      order: { updated_at: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return paginate(items, total, page, pageSize);
  }

  async findOneForUser(id: string, userId: string): Promise<Ticket> {
    const ticket = await this.tickets.findOne({
      where: { id },
      relations: { messages: { attachments: true } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.user_id !== userId) throw new ForbiddenException('Access denied');
    return this.withOrderedMessages(ticket);
  }

  async createForUser(
    userId: string,
    dto: CreateTicketDto,
  ): Promise<Ticket> {
    const ticket = this.tickets.create({
      user_id: userId,
      subject: dto.subject,
      category: (dto.category as any) ?? 'general',
      priority: (dto.priority as any) ?? 'medium',
    });
    const saved = await this.tickets.save(ticket);

    const msg = this.messages.create({
      ticket_id: saved.id,
      sender_type: 'user',
      sender_id: userId,
      message: dto.message,
    });
    await this.messages.save(msg);

    return this.findOneForUser(saved.id, userId);
  }

  async addMessageForUser(
    ticketId: string,
    userId: string,
    dto: CreateTicketMessageDto,
  ): Promise<TicketMessage> {
    const ticket = await this.findOneForUser(ticketId, userId);
    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('Cannot reply to a closed ticket');
    }

    const msg = this.messages.create({
      ticket_id: ticketId,
      sender_type: 'user',
      sender_id: userId,
      message: dto.message,
    });
    const saved = await this.messages.save(msg);

    if (ticket.status !== TicketStatus.OPEN) {
      ticket.status = TicketStatus.OPEN;
      await this.tickets.save(ticket);
    }

    return saved;
  }

  async closeForUser(ticketId: string, userId: string): Promise<Ticket> {
    const ticket = await this.findOneForUser(ticketId, userId);
    ticket.status = TicketStatus.CLOSED;
    ticket.closed_at = new Date();
    const saved = await this.tickets.save(ticket);
    return saved;
  }

  // --- Admin methods ---

  async listAll(
    query: PaginationQueryDto & { status?: string; user_id?: string },
  ): Promise<PaginatedResult<Ticket>> {
    const { page, pageSize, status, user_id } = query;
    const where: any = {};
    if (status) where.status = status;
    if (user_id) where.user_id = user_id;
    const [items, total] = await this.tickets.findAndCount({
      where,
      relations: { user: true },
      order: { updated_at: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return paginate(items, total, page, pageSize);
  }

  async findOneAdmin(id: string): Promise<Ticket> {
    const ticket = await this.tickets.findOne({
      where: { id },
      relations: { user: true, messages: { attachments: true } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return this.withOrderedMessages(ticket);
  }

  async addMessageForAdmin(
    ticketId: string,
    adminId: string,
    dto: CreateTicketMessageDto,
  ): Promise<TicketMessage> {
    const ticket = await this.findOneAdmin(ticketId);
    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('Cannot reply to a closed ticket');
    }

    const msg = this.messages.create({
      ticket_id: ticketId,
      sender_type: 'admin',
      sender_id: adminId,
      message: dto.message,
    });
    const saved = await this.messages.save(msg);

    if (ticket.status !== TicketStatus.REPLIED) {
      ticket.status = TicketStatus.REPLIED;
      await this.tickets.save(ticket);
    }

    await this.notifyClient(
      ticket.user_id,
      'New response on your ticket',
      `There is an update on your ticket "${ticket.subject}".`,
      `/support/${ticketId}`,
    );

    return saved;
  }

  async updateStatus(id: string, status: string): Promise<Ticket> {
    const ticket = await this.findOneAdmin(id);
    const wasOpen = ticket.status !== TicketStatus.CLOSED;
    ticket.status = status as TicketStatus;
    if (status === TicketStatus.CLOSED) {
      ticket.closed_at = new Date();
    }
    const saved = await this.tickets.save(ticket);

    if (status === TicketStatus.CLOSED && wasOpen) {
      await this.notifyClient(
        ticket.user_id,
        'Your ticket has been resolved',
        `Your ticket "${ticket.subject}" has been closed. If you need anything else, feel free to create a new ticket.`,
        '/support',
      );
    }

    return saved;
  }

  // --- Attachments ---

  async createAttachmentUrl(
    ticketMessageId: string,
    dto: TicketAttachmentUploadDto,
  ): Promise<{ attachment_id: string; upload_url: string; s3_key: string }> {
    const msg = await this.messages.findOne({
      where: { id: ticketMessageId },
    });
    if (!msg) throw new NotFoundException('Ticket message not found');

    const ext = dto.filename.split('.').pop()?.toLowerCase() ?? 'bin';
    const safe = dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const s3Key = `tickets/${msg.ticket_id}/${msg.id}/${unique}_${safe}.${ext}`;

    const att = await this.attachments.save(
      this.attachments.create({
        ticket_message_id: ticketMessageId,
        s3_key: s3Key,
        original_filename: dto.filename,
        file_size_bytes: String(dto.file_size_bytes),
      }),
    );

    // Generate a presigned upload URL using PutObject
    const uploadUrl = await this.storage.createTicketUploadUrl(
      s3Key,
      dto.content_type,
    );

    return { attachment_id: att.id, upload_url: uploadUrl, s3_key: s3Key };
  }

  async createAttachmentUrlForUser(
    ticketMessageId: string,
    userId: string,
    dto: TicketAttachmentUploadDto,
  ): Promise<{ attachment_id: string; upload_url: string; s3_key: string }> {
    const msg = await this.messages.findOne({
      where: { id: ticketMessageId },
    });
    if (!msg) throw new NotFoundException('Ticket message not found');
    const ticket = await this.tickets.findOneBy({ id: msg.ticket_id });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.user_id !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('Cannot add attachments to a closed ticket');
    }
    return this.createAttachmentUrl(ticketMessageId, dto);
  }

  async getAttachmentDownloadUrlForUser(
    attachmentId: string,
    userId: string,
  ): Promise<{ download_url: string }> {
    const att = await this.attachments.findOneBy({ id: attachmentId });
    if (!att) throw new NotFoundException('Attachment not found');
    const msg = await this.messages.findOneBy({ id: att.ticket_message_id });
    if (!msg) throw new NotFoundException('Attachment not found');
    const ticket = await this.tickets.findOneBy({ id: msg.ticket_id });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.user_id !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return { download_url: await this.storage.createDownloadUrl(att.s3_key) };
  }

  async getAttachmentDownloadUrl(
    attachmentId: string,
  ): Promise<{ download_url: string }> {
    const att = await this.attachments.findOneBy({ id: attachmentId });
    if (!att) throw new NotFoundException('Attachment not found');
    return { download_url: await this.storage.createDownloadUrl(att.s3_key) };
  }

  // --- Helpers ---

  private withOrderedMessages(ticket: Ticket): Ticket {
    if (ticket.messages) {
      ticket.messages = [...ticket.messages].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    }
    return ticket;
  }

  private async notifyClient(
    userId: string,
    title: string,
    body: string,
    deepLink: string,
  ): Promise<void> {
    try {
      const user = await this.usersService.findOne(userId);
      if (!user) return;

      await this.reportNotifications.record(userId, title, body, deepLink);

      const pushTargets = await this.usersService.getTokensForPush(userId);
      for (const token of pushTargets) {
        let subscription: unknown;
        try {
          subscription = JSON.parse(token.push_token);
        } catch {
          subscription = null;
        }
        if (isPushSubscription(subscription)) {
          await this.notifications.sendPush(subscription, {
            title,
            body,
            url: deepLink,
          });
        }
      }

      const url = `${process.env.API_BASE_URL ?? ''}${deepLink}`;
      await this.notifications.sendEmail(
        { email: user.email, name: user.name },
        title,
        `<p>Dear ${user.name},</p><p>${body}</p><p><a href="${url}">View in the app</a></p>`,
      );
    } catch (error) {
      // Notification errors must never break the core ticket flow.
      this.notifications['logger']?.warn(
        `Ticket notification failed for user ${userId}: ${(error as Error).message}`,
      );
    }
  }
}

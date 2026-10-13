import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import {
  WhatsappConversation,
  WhatsappConversationStatus,
} from '../entities/whatsapp-conversation.entity';
import {
  WhatsappMessage,
  WhatsappMessageType,
} from '../entities/whatsapp-message.entity';
import { User } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { WhatsappEventsService } from './whatsapp-events.service';

export interface ConversationListQuery {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface UpdateConversationDto {
  clientName?: string;
  businessName?: string;
  gstin?: string;
  verified?: boolean;
  internalNotes?: string;
}

@Injectable()
export class WhatsappChatsService {
  private readonly logger = new Logger(WhatsappChatsService.name);

  constructor(
    @InjectRepository(WhatsappConversation)
    private readonly convRepo: Repository<WhatsappConversation>,
    @InjectRepository(WhatsappMessage)
    private readonly msgRepo: Repository<WhatsappMessage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
    private readonly eventsService: WhatsappEventsService,
  ) {}

  /**
   * Attempts to match a WhatsApp phone number with a registered portal client (users table).
   * Strips formatting and compares the last 10 digits.
   */
  async findMatchingUserByPhone(phoneNumber: string): Promise<User | null> {
    if (!phoneNumber) return null;
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    if (digitsOnly.length < 10) return null;
    const tenDigit = digitsOnly.slice(-10);

    const users = await this.userRepo
      .createQueryBuilder('u')
      .where(
        "u.phone IS NOT NULL AND RIGHT(REGEXP_REPLACE(u.phone, '[^0-9]', 'g'), 10) = :tenDigit",
        { tenDigit },
      )
      .orderBy('u.created_at', 'DESC')
      .getMany();

    return users.length > 0 ? users[0] : null;
  }

  /**
   * Find an existing conversation or create a new one for a given WhatsApp phone number (wa_id).
   * Automatically matches and links against registered portal clients.
   */
  async findOrCreateConversation(
    phoneNumber: string,
    profileName?: string,
  ): Promise<WhatsappConversation> {
    let conv = await this.convRepo.findOne({
      where: { phoneNumber },
      relations: { client: true },
    });

    const matchingUser = await this.findMatchingUserByPhone(phoneNumber);

    if (!conv) {
      conv = this.convRepo.create({
        phoneNumber,
        clientName: matchingUser ? matchingUser.name : (profileName || null),
        clientId: matchingUser ? matchingUser.id : null,
        gstin: matchingUser?.gstin || null,
        verified: !!matchingUser,
        status: 'ai_handling',
        unreadCount: 0,
      });
      conv = await this.convRepo.save(conv);
      if (matchingUser) {
        conv.client = matchingUser;
      }
      this.eventsService.emit({
        type: 'conversation',
        conversationId: conv.id,
      });
    } else {
      let needsSave = false;
      if (matchingUser && (!conv.clientId || !conv.verified)) {
        conv.clientId = matchingUser.id;
        conv.client = matchingUser;
        conv.clientName = matchingUser.name;
        if (!conv.gstin && matchingUser.gstin) {
          conv.gstin = matchingUser.gstin;
        }
        conv.verified = true;
        needsSave = true;
      } else if (profileName && !conv.clientName) {
        conv.clientName = profileName;
        needsSave = true;
      }

      if (needsSave) {
        conv = await this.convRepo.save(conv);
      }
    }
    return conv;
  }

  /**
   * Records an inbound message from a client (with deduplication on meta_message_id).
   */
  async recordInboundMessage(params: {
    phoneNumber: string;
    profileName?: string;
    metaMessageId?: string;
    messageType?: WhatsappMessageType;
    body?: string;
    mediaUrl?: string;
  }): Promise<{
    conversation: WhatsappConversation;
    message: WhatsappMessage;
    isDuplicate: boolean;
  }> {
    const conv = await this.findOrCreateConversation(
      params.phoneNumber,
      params.profileName,
    );

    if (params.metaMessageId) {
      const existing = await this.msgRepo.findOne({
        where: { metaMessageId: params.metaMessageId },
      });
      if (existing) {
        return { conversation: conv, message: existing, isDuplicate: true };
      }
    }

    const msg = this.msgRepo.create({
      conversationId: conv.id,
      metaMessageId: params.metaMessageId || null,
      direction: 'inbound',
      sender: 'client',
      messageType: params.messageType || 'text',
      body: params.body || null,
      mediaUrl: params.mediaUrl || null,
    });
    const savedMsg = await this.msgRepo.save(msg);

    // If conversation was marked closed, auto-reopen to AI handling on new customer activity
    if (conv.status === 'closed') {
      conv.status = 'ai_handling';
    }

    conv.unreadCount = (conv.unreadCount || 0) + 1;
    conv.lastMessageAt = new Date();
    await this.convRepo.save(conv);

    this.eventsService.emit({
      type: 'message',
      conversationId: conv.id,
      data: savedMsg,
    });
    this.eventsService.emit({
      type: 'conversation',
      conversationId: conv.id,
    });

    return { conversation: conv, message: savedMsg, isDuplicate: false };
  }

  /**
   * Records an outbound AI message.
   */
  async recordOutboundAiMessage(
    conversationId: string,
    body: string,
  ): Promise<WhatsappMessage> {
    const msg = this.msgRepo.create({
      conversationId,
      direction: 'outbound',
      sender: 'ai',
      messageType: 'text',
      body,
    });
    const savedMsg = await this.msgRepo.save(msg);

    await this.convRepo.update(conversationId, {
      lastMessageAt: new Date(),
    });

    this.eventsService.emit({
      type: 'message',
      conversationId,
      data: savedMsg,
    });
    this.eventsService.emit({
      type: 'conversation',
      conversationId,
    });

    return savedMsg;
  }

  /**
   * List conversations with search, filter, and pagination.
   * Auto-links to portal client records if matched by phone.
   */
  async listConversations(query: ConversationListQuery) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const qb = this.convRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.client', 'client');

    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        "(LOWER(c.phoneNumber) LIKE :term OR LOWER(COALESCE(c.clientName, '')) LIKE :term OR LOWER(COALESCE(c.businessName, '')) LIKE :term OR LOWER(COALESCE(c.gstin, '')) LIKE :term OR LOWER(COALESCE(client.name, '')) LIKE :term OR LOWER(COALESCE(client.email, '')) LIKE :term)",
        { term },
      );
    }

    qb.orderBy('c.lastMessageAt', 'DESC', 'NULLS LAST')
      .addOrderBy('c.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    // Attach last message preview and perform on-the-fly auto-link if unlinked
    const enriched = await Promise.all(
      items.map(async (conv) => {
        if (!conv.clientId) {
          const matched = await this.findMatchingUserByPhone(conv.phoneNumber);
          if (matched) {
            conv.clientId = matched.id;
            conv.client = matched;
            conv.clientName = matched.name;
            if (!conv.gstin && matched.gstin) {
              conv.gstin = matched.gstin;
            }
            conv.verified = true;
            await this.convRepo.update(conv.id, {
              clientId: matched.id,
              clientName: matched.name,
              gstin: conv.gstin,
              verified: true,
            });
          }
        }

        const lastMsg = await this.msgRepo.findOne({
          where: { conversationId: conv.id },
          order: { createdAt: 'DESC' },
        });

        return {
          ...conv,
          lastMessage: lastMsg
            ? {
                id: lastMsg.id,
                sender: lastMsg.sender,
                body: lastMsg.body,
                messageType: lastMsg.messageType,
                createdAt: lastMsg.createdAt,
              }
            : null,
        };
      }),
    );

    return {
      items: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Fetch thread messages for a conversation.
   */
  async getMessages(conversationId: string, limit = 200, before?: string) {
    const qb = this.msgRepo
      .createQueryBuilder('m')
      .where('m.conversationId = :conversationId', { conversationId });

    if (before) {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        qb.andWhere('m.createdAt < :beforeDate', { beforeDate });
      }
    }

    qb.orderBy('m.createdAt', 'ASC').take(Math.min(500, Math.max(1, limit)));

    return qb.getMany();
  }

  /**
   * Staff sends a message through the WhatsApp Cloud API.
   * Checks the 24-hour service window constraint.
   */
  async sendStaffMessage(
    conversationId: string,
    body: string,
    staffId: string,
  ): Promise<WhatsappMessage> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }

    const trimmed = body?.trim();
    if (!trimmed) {
      throw new BadRequestException('Message body cannot be empty');
    }

    // Verify 24-hour customer service window
    const lastInbound = await this.msgRepo.findOne({
      where: { conversationId, direction: 'inbound' },
      order: { createdAt: 'DESC' },
    });

    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (
      !lastInbound ||
      now - new Date(lastInbound.createdAt).getTime() > twentyFourHours
    ) {
      throw new BadRequestException(
        'The 24-hour WhatsApp customer service window has expired. You cannot send free-form text messages. The client must message first or an approved utility template must be sent.',
      );
    }

    // Send via Meta Cloud API
    const sent = await this.notificationsService.sendWhatsapp(
      conv.phoneNumber,
      trimmed,
    );
    if (!sent) {
      throw new BadRequestException(
        'Failed to deliver message via WhatsApp Cloud API. Please verify token and connection.',
      );
    }

    const msg = this.msgRepo.create({
      conversationId: conv.id,
      direction: 'outbound',
      sender: 'staff',
      messageType: 'text',
      body: trimmed,
      staffId,
    });
    const saved = await this.msgRepo.save(msg);

    conv.lastMessageAt = new Date();
    await this.convRepo.save(conv);

    this.eventsService.emit({
      type: 'message',
      conversationId: conv.id,
      data: saved,
    });
    this.eventsService.emit({
      type: 'conversation',
      conversationId: conv.id,
    });

    return saved;
  }

  async takeover(conversationId: string, staffId: string) {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation not found');
    conv.status = 'staff_takeover';
    conv.assignedStaffId = staffId;
    const saved = await this.convRepo.save(conv);
    this.eventsService.emit({ type: 'conversation', conversationId });
    return saved;
  }

  async release(conversationId: string) {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation not found');
    conv.status = 'ai_handling';
    conv.assignedStaffId = null;
    const saved = await this.convRepo.save(conv);
    this.eventsService.emit({ type: 'conversation', conversationId });
    return saved;
  }

  async setStatus(conversationId: string, status: WhatsappConversationStatus) {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation not found');
    conv.status = status;
    const saved = await this.convRepo.save(conv);
    this.eventsService.emit({ type: 'conversation', conversationId });
    return saved;
  }

  async markAsRead(conversationId: string) {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation not found');
    conv.unreadCount = 0;
    const saved = await this.convRepo.save(conv);
    this.eventsService.emit({ type: 'conversation', conversationId });
    return saved;
  }

  async updateConversation(conversationId: string, dto: UpdateConversationDto) {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation not found');

    if (dto.clientName !== undefined) conv.clientName = dto.clientName;
    if (dto.businessName !== undefined) conv.businessName = dto.businessName;
    if (dto.gstin !== undefined) conv.gstin = dto.gstin;
    if (dto.verified !== undefined) conv.verified = dto.verified;
    if (dto.internalNotes !== undefined) conv.internalNotes = dto.internalNotes;

    const saved = await this.convRepo.save(conv);
    this.eventsService.emit({ type: 'conversation', conversationId });
    return saved;
  }

  /**
   * Monthly usage statistics: monitors free tier budget (1,000 service messages/month).
   */
  async getMonthlyUsageStats() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const outboundServiceMsgs = await this.msgRepo.count({
      where: {
        direction: 'outbound',
        messageType: 'text',
        createdAt: MoreThanOrEqual(startOfMonth),
      },
    });

    const outboundTemplates = await this.msgRepo.count({
      where: {
        direction: 'outbound',
        messageType: 'template',
        createdAt: MoreThanOrEqual(startOfMonth),
      },
    });

    const freeLimit = 1000;
    const remainingFree = Math.max(0, freeLimit - outboundServiceMsgs);

    return {
      month: startOfMonth.toISOString().slice(0, 7),
      outboundServiceMessages: outboundServiceMsgs,
      outboundTemplateMessages: outboundTemplates,
      freeTierLimit: freeLimit,
      remainingFreeServiceMessages: remainingFree,
      percentUsed: Math.min(
        100,
        Math.round((outboundServiceMsgs / freeLimit) * 100),
      ),
    };
  }
}

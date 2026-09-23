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
import { StorageService } from '../storage/storage.service';
import {
  countTemplateParams,
  renderTemplateBody,
  WHATSAPP_TEMPLATE_DEFAULTS,
  WhatsappTemplateKey,
} from '../notifications/whatsapp-templates';
import { WhatsappEventsService } from './whatsapp-events.service';

export interface ConversationListQuery {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface SendTemplateParams {
  template: string;
  language?: string;
  params?: string[];
  staffId?: string | null;
  sender?: 'staff' | 'ai';
  headerDocument?: { link: string; filename: string };
}

export interface WhatsappTemplateOption {
  name: string;
  language: string;
  category: string;
  body: string;
  paramCount: number;
  paramLabels: string[];
}

const TEMPLATE_CACHE_MS = 10 * 60 * 1000;
const MEDIA_URL_TTL_SECONDS = 60 * 60;

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
    private readonly storage: StorageService,
  ) {}

  private templateCache: {
    at: number;
    items: WhatsappTemplateOption[];
  } | null = null;

  /**
   * media_url holds either an absolute URL (R2 public) or a private S3 key.
   * Keys are swapped for a signed GET URL so the admin desk can render them.
   */
  async withSignedMedia(msg: WhatsappMessage): Promise<WhatsappMessage> {
    if (!msg.mediaUrl || /^https?:\/\//i.test(msg.mediaUrl)) return msg;
    try {
      const url = await this.storage.createDownloadUrl(
        msg.mediaUrl,
        MEDIA_URL_TTL_SECONDS,
      );
      return { ...msg, mediaUrl: url };
    } catch (err) {
      this.logger.warn(
        `Could not sign WhatsApp media ${msg.mediaUrl}: ${(err as Error).message}`,
      );
      return msg;
    }
  }

  private async emitMessage(msg: WhatsappMessage): Promise<void> {
    this.eventsService.emit({
      type: 'message',
      conversationId: msg.conversationId,
      data: await this.withSignedMedia(msg),
    });
    this.eventsService.emit({
      type: 'conversation',
      conversationId: msg.conversationId,
    });
  }

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
        clientName: matchingUser ? matchingUser.name : profileName || null,
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
    mediaFilename?: string;
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
      mediaFilename: params.mediaFilename || null,
    });
    const savedMsg = await this.msgRepo.save(msg);

    // If conversation was marked closed, auto-reopen to AI handling on new customer activity
    if (conv.status === 'closed') {
      conv.status = 'ai_handling';
    }

    conv.unreadCount = (conv.unreadCount || 0) + 1;
    conv.lastMessageAt = new Date();
    await this.convRepo.save(conv);

    await this.emitMessage(savedMsg);

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

    await this.emitMessage(savedMsg);

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

    const messages = await qb.getMany();
    return Promise.all(messages.map((m) => this.withSignedMedia(m)));
  }

  /** Updates a message body in place (e.g. adding a voice-note transcript). */
  async updateMessageBody(messageId: string, body: string): Promise<void> {
    const msg = await this.msgRepo.findOne({ where: { id: messageId } });
    if (!msg) return;
    msg.body = body;
    const saved = await this.msgRepo.save(msg);
    await this.emitMessage(saved);
  }

  async findConversation(id: string): Promise<WhatsappConversation | null> {
    return this.convRepo.findOne({ where: { id } });
  }

  async setPendingUpload(
    conversationId: string,
    pending: WhatsappConversation['pendingUpload'],
  ): Promise<void> {
    await this.convRepo.update(conversationId, { pendingUpload: pending });
  }

  /**
   * Approved templates for the admin composer: Meta's approved list, with
   * friendly parameter labels for the platform's own templates.
   */
  async listTemplates(): Promise<WhatsappTemplateOption[]> {
    if (
      this.templateCache &&
      Date.now() - this.templateCache.at < TEMPLATE_CACHE_MS
    ) {
      return this.templateCache.items;
    }
    const known = this.knownTemplates();
    const approved = await this.notificationsService.listApprovedTemplates();

    const items: WhatsappTemplateOption[] = approved.map((t) => {
      const ours = known.find((k) => k.name === t.name);
      const paramCount = countTemplateParams(t.body);
      return {
        name: t.name,
        language: t.language,
        category: t.category,
        body: t.body,
        paramCount,
        paramLabels:
          ours?.params ??
          Array.from({ length: paramCount }, (_v, i) => `Value ${i + 1}`),
      };
    });
    this.templateCache = { at: Date.now(), items };
    return items;
  }

  /**
   * Sends an approved template to a phone number, creating the conversation
   * if needed, and records it in the thread. Templates are the only way to
   * message a client outside the 24h customer-service window.
   */
  async sendTemplate(
    phoneNumber: string,
    opts: SendTemplateParams,
  ): Promise<{ conversation: WhatsappConversation; message: WhatsappMessage }> {
    const params = opts.params ?? [];
    const language =
      opts.language ??
      this.notificationsService.templateDef('generalFollowup').language;

    const sent = await this.notificationsService.sendWhatsappTemplate(
      phoneNumber,
      opts.template,
      language,
      params,
      opts.headerDocument,
    );
    if (!sent) {
      throw new BadRequestException(
        `WhatsApp template "${opts.template}" could not be delivered. Check that it is approved in Meta and all values are filled in.`,
      );
    }

    const conv = await this.findOrCreateConversation(
      this.normalizeWaId(phoneNumber),
    );
    const body = renderTemplateBody(
      await this.templateBody(opts.template),
      params,
    );

    const msg = this.msgRepo.create({
      conversationId: conv.id,
      direction: 'outbound',
      sender: opts.sender ?? 'staff',
      messageType: 'template',
      templateName: opts.template,
      body,
      staffId: opts.staffId ?? null,
      mediaFilename: opts.headerDocument?.filename ?? null,
    });
    const saved = await this.msgRepo.save(msg);
    conv.lastMessageAt = new Date();
    await this.convRepo.save(conv);
    await this.emitMessage(saved);
    return { conversation: conv, message: saved };
  }

  /**
   * Staff starts (or re-opens, after the 24h window) a conversation with an
   * approved template. The thread is put in staff_takeover so the AI does not
   * jump in when the client replies.
   */
  async startWithTemplate(
    target: { client_id?: string; phone?: string; conversation_id?: string },
    opts: { template: string; language?: string; params?: string[] },
    staffId: string,
  ) {
    let phone = target.phone?.trim();
    if (target.conversation_id) {
      const conv = await this.convRepo.findOne({
        where: { id: target.conversation_id },
      });
      if (!conv) throw new NotFoundException('Conversation not found');
      phone = conv.phoneNumber;
    } else if (target.client_id) {
      const client = await this.userRepo.findOne({
        where: { id: target.client_id },
      });
      if (!client) throw new NotFoundException('Client not found');
      if (!client.phone) {
        throw new BadRequestException(
          'This client has no phone number on their profile',
        );
      }
      phone = client.phone;
    }
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      throw new BadRequestException('A valid phone number is required');
    }

    const approved = await this.listTemplates();
    const tpl = approved.find(
      (t) =>
        t.name === opts.template &&
        (!opts.language || t.language === opts.language),
    );
    if (!tpl) {
      throw new BadRequestException(
        `Template "${opts.template}" is not approved on the WhatsApp account`,
      );
    }
    const params = (opts.params ?? []).map((p) => p?.trim() ?? '');
    if (params.length < tpl.paramCount || params.some((p) => !p)) {
      throw new BadRequestException(
        `Fill in all ${tpl.paramCount} template values before sending`,
      );
    }

    const result = await this.sendTemplate(phone, {
      template: tpl.name,
      language: tpl.language,
      params: params.slice(0, tpl.paramCount),
      staffId,
      sender: 'staff',
    });
    const conv = await this.takeover(result.conversation.id, staffId);
    return { conversation: conv, message: result.message };
  }

  /** Same wa_id format Meta uses for inbound messages (91XXXXXXXXXX). */
  normalizeWaId(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 ? `91${digits}` : digits;
  }

  private knownTemplates() {
    return (
      Object.keys(WHATSAPP_TEMPLATE_DEFAULTS) as WhatsappTemplateKey[]
    ).map((key) => this.notificationsService.templateDef(key));
  }

  private async templateBody(name: string): Promise<string> {
    const known = this.knownTemplates().find((t) => t.name === name);
    if (known) return known.body;
    const approved = await this.listTemplates();
    return approved.find((t) => t.name === name)?.body ?? `[Template: ${name}]`;
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

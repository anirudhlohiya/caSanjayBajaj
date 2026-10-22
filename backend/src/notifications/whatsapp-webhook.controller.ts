import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  HttpStatus,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { Repository } from 'typeorm';
import {
  User,
  ClientCertificate,
  ItrReturn,
  Report,
  ComplianceTask,
  Document,
  GstFilingPeriod,
  WhatsappConversation,
} from '../entities';
import {
  CertType,
  ComplianceCategory,
  DocumentCategory,
  DocumentFileType,
  DocumentStatus,
  TaskStatus,
} from '../common/enums';
import { NotificationsService } from './notifications.service';
import { WhatsappAiService } from './whatsapp-ai.service';
import { WhatsappMediaService } from './whatsapp-media.service';
import { WhatsappChatsService } from '../whatsapp-chats/whatsapp-chats.service';
import { StorageService } from '../storage/storage.service';
import { WhatsappMessageType } from '../entities/whatsapp-message.entity';

interface WhatsappMediaAttachment {
  id: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
  filename?: string;
}

interface WhatsappIncomingMessage {
  from: string;
  id: string;
  timestamp?: string;
  type?: string;
  text?: { body: string };
  image?: WhatsappMediaAttachment;
  document?: WhatsappMediaAttachment;
  audio?: WhatsappMediaAttachment;
  interactive?: {
    type?: 'list_reply' | 'button_reply';
    list_reply?: { id: string; title: string; description?: string };
    button_reply?: { id: string; title: string };
  };
}

interface WhatsappWebhookBody {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        messages?: WhatsappIncomingMessage[];
        contacts?: Array<{
          profile?: { name?: string };
          wa_id?: string;
        }>;
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        statuses?: unknown[];
      };
      field?: string;
    }>;
  }>;
}

@Controller('notifications/whatsapp-webhook')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly whatsappAiService: WhatsappAiService,
    private readonly mediaService: WhatsappMediaService,
    private readonly storage: StorageService,
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => WhatsappChatsService))
    private readonly chatsService: WhatsappChatsService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ClientCertificate)
    private readonly certRepo: Repository<ClientCertificate>,
    @InjectRepository(ItrReturn)
    private readonly itrRepo: Repository<ItrReturn>,
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(ComplianceTask)
    private readonly taskRepo: Repository<ComplianceTask>,
    @InjectRepository(Document)
    private readonly docRepo: Repository<Document>,
    @InjectRepository(GstFilingPeriod)
    private readonly periodRepo: Repository<GstFilingPeriod>,
  ) {}

  @Get()
  verifyWebhook(@Req() req: Request, @Res() res: Response) {
    const mode = req.query['hub.mode'];
    const token =
      typeof req.query['hub.verify_token'] === 'string'
        ? req.query['hub.verify_token']
        : '';
    const challenge = req.query['hub.challenge'];

    const verifyToken = this.configService.get<string>('whatsapp.verifyToken');

    if (mode && token) {
      if (mode === 'subscribe' && token === verifyToken) {
        this.logger.log('WhatsApp Webhook successfully verified by Meta');
        return res.status(HttpStatus.OK).send(challenge);
      } else {
        this.logger.warn(
          `Webhook verification token mismatch. Received: ${token}, Expected: ${verifyToken ?? ''}`,
        );
        return res.sendStatus(HttpStatus.FORBIDDEN);
      }
    }

    return res.sendStatus(HttpStatus.BAD_REQUEST);
  }

  @Post()
  handleWebhook(@Req() req: Request, @Res() res: Response) {
    const body = req.body as WhatsappWebhookBody;

    // Acknowledge Meta immediately with 200 OK so Meta doesn't retry unnecessarily
    res.sendStatus(HttpStatus.OK);

    if (body.object && body.entry) {
      for (const entry of body.entry) {
        if (!entry.changes) continue;
        for (const change of entry.changes) {
          const value = change.value;
          if (!value?.messages || value.messages.length === 0) {
            continue;
          }

          const phoneNumberId = value.metadata?.phone_number_id;

          // Map contacts by wa_id for profile names
          const contactsMap = new Map<string, string>();
          if (value.contacts && Array.isArray(value.contacts)) {
            for (const c of value.contacts) {
              if (c.wa_id && c.profile?.name) {
                contactsMap.set(c.wa_id, c.profile.name);
              }
            }
          }

          for (const message of value.messages) {
            const from = message.from;
            const messageId = message.id;
            const contactName = contactsMap.get(from) || undefined;

            if (!from || !messageId) {
              continue;
            }

            // Process message asynchronously
            void this.processMessageAsync(
              message,
              from,
              messageId,
              contactName,
              phoneNumberId,
            );
          }
        }
      }
    }
  }

  /**
   * Main asynchronous message processing router.
   */
  private async processMessageAsync(
    message: WhatsappIncomingMessage,
    from: string,
    messageId: string,
    contactName?: string,
    phoneNumberId?: string,
  ): Promise<void> {
    try {
      let msgType: WhatsappMessageType = 'text';
      let msgBody: string | undefined = undefined;
      let rawMediaAttachment: WhatsappMediaAttachment | undefined = undefined;

      // Extract message content
      if (message.type === 'text' && message.text?.body) {
        msgType = 'text';
        msgBody = message.text.body;
      } else if (message.type === 'interactive') {
        msgType = 'text';
        msgBody =
          message.interactive?.list_reply?.id ||
          message.interactive?.list_reply?.title ||
          message.interactive?.button_reply?.id ||
          message.interactive?.button_reply?.title;
      } else if (message.type === 'image' && message.image) {
        msgType = 'image';
        rawMediaAttachment = message.image;
        msgBody = message.image.caption || '[Photo received]';
      } else if (message.type === 'document' && message.document) {
        msgType = 'document';
        rawMediaAttachment = message.document;
        const name = message.document.filename || 'Document';
        msgBody = message.document.caption
          ? `${name}: ${message.document.caption}`
          : name;
      } else if (message.type === 'audio' && message.audio) {
        msgType = 'audio';
        rawMediaAttachment = message.audio;
        msgBody = '[Voice note received]';
      } else {
        msgType = 'text';
        msgBody = `[Unsupported message type: ${message.type || 'unknown'}]`;
      }

      // 1. Check if sender matches registered client in users table (strict 10-digit match)
      const user = await this.chatsService.findMatchingUserByPhone(from);

      // 2. Handle media download & storage if attachment is present
      let mediaS3Key: string | undefined = undefined;
      let mediaPublicUrl: string | undefined = undefined;
      let uploadedFilename: string | undefined = undefined;

      if (rawMediaAttachment) {
        const clientFolder = user ? user.id : from;
        const stored = await this.mediaService.processAndStoreMedia(
          rawMediaAttachment.id,
          rawMediaAttachment.mime_type,
          rawMediaAttachment.filename,
          clientFolder,
        );

        if (stored) {
          mediaS3Key = stored.s3Key;
          mediaPublicUrl = stored.publicUrl;
          uploadedFilename = stored.filename;

          // If registered client, create a document record in our database
          if (user) {
            let fileType = DocumentFileType.PDF;
            if (rawMediaAttachment.mime_type?.includes('image/')) {
              fileType = DocumentFileType.IMAGE;
            } else if (
              rawMediaAttachment.mime_type?.includes('spreadsheet') ||
              rawMediaAttachment.mime_type?.includes('excel') ||
              rawMediaAttachment.mime_type?.includes('csv')
            ) {
              fileType = DocumentFileType.EXCEL;
            }

            try {
              const doc = this.docRepo.create({
                user_id: user.id,
                category: DocumentCategory.GENERAL,
                s3_key: stored.s3Key,
                original_filename: stored.filename,
                file_type: fileType,
                status: DocumentStatus.RECEIVED,
                file_size_bytes: String(stored.sizeBytes),
                uploaded_at: new Date(),
              });
              await this.docRepo.save(doc);
              this.logger.log(
                `Created Document record for client ${user.id} (${stored.filename})`,
              );
            } catch (docErr) {
              this.logger.error(
                `Failed to create Document record: ${(docErr as Error).message}`,
              );
            }
          }
        }
      }

      // 3. Record inbound message in DB (with deduplication on meta_message_id)
      const recordResult = await this.chatsService.recordInboundMessage({
        phoneNumber: from,
        profileName: contactName,
        metaMessageId: messageId,
        messageType: msgType,
        body: msgBody,
        mediaUrl: mediaPublicUrl || mediaS3Key,
      });

      if (recordResult.isDuplicate) {
        this.logger.debug(
          `Inbound message ${messageId} is duplicate; skipping.`,
        );
        return;
      }

      const conversation = recordResult.conversation;

      // 4. Check conversation status - AI SUPPRESSION RULE
      if (conversation.status === 'staff_takeover') {
        this.logger.log(
          `Conversation ${conversation.id} is in staff_takeover status. AI reply suppressed.`,
        );
        return;
      }

      // 5. FLOW — UNREGISTERED NUMBER
      if (!user) {
        await this.handleUnregisteredSender(
          from,
          msgBody || '',
          conversation,
          phoneNumberId,
        );
        return;
      }

      // 6. FLOW — REGISTERED CLIENT
      await this.handleRegisteredClient(
        user,
        from,
        msgType,
        msgBody || '',
        uploadedFilename,
        conversation,
        messageId,
        phoneNumberId,
      );
    } catch (err) {
      this.logger.error(
        `Error processing WhatsApp message for ${from}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  /**
   * Handles messages from unregistered phone numbers.
   * Greet, state service is for registered clients, provide registration link, log lead, zero data leaked.
   */
  private async handleUnregisteredSender(
    from: string,
    rawText: string,
    conversation: WhatsappConversation,
    phoneNumberId?: string,
  ): Promise<void> {
    const textLower = rawText.toLowerCase().trim();

    // Refuse any attempts to ask for other people's or client data
    if (
      textLower.includes('client') ||
      textLower.includes('gstin') ||
      textLower.includes('dues') ||
      textLower.includes('status') ||
      textLower.includes('document')
    ) {
      const refusalMsg =
        'Namaste. This WhatsApp service is for registered clients of *S N Bajaj & Co*. For security, account and tax details are only accessible to registered numbers. Please register your account here: https://app.snbajaj.com/register';
      await this.sendAndRecordReply(
        conversation.id,
        from,
        refusalMsg,
        phoneNumberId,
      );
      return;
    }

    // Default unregistered response: brief, warm, asks to register
    const replyText =
      'Namaste! Thank you for reaching out to *S N Bajaj & Co* (Chartered Accountants). This WhatsApp channel is for our registered clients. Please create your account here to get started: https://app.snbajaj.com/register';

    // Log as unknown lead in conversation notes
    const note = `[Unknown Lead] Inquired on ${new Date().toLocaleDateString('en-IN')}`;
    if (!conversation.internalNotes?.includes('[Unknown Lead]')) {
      await this.chatsService.updateConversation(conversation.id, {
        internalNotes: conversation.internalNotes
          ? `${conversation.internalNotes}\n${note}`
          : note,
      });
    }

    await this.sendAndRecordReply(
      conversation.id,
      from,
      replyText,
      phoneNumberId,
    );
  }

  /**
   * Handles messages from registered clients.
   * Menu, Direct Uploads, Pending Docs, Document Request, Payment Status, Human Takeover, KB Questions.
   */
  private async handleRegisteredClient(
    user: User,
    from: string,
    msgType: WhatsappMessageType,
    msgBody: string,
    uploadedFilename: string | undefined,
    conversation: WhatsappConversation,
    messageId: string,
    phoneNumberId?: string,
  ): Promise<void> {
    const text = msgBody.trim();
    const lower = text.toLowerCase();

    // 1. Media sent directly in chat → Send short acknowledgment
    if (msgType === 'image' || msgType === 'document' || msgType === 'audio') {
      const fileNameDisplay = uploadedFilename || 'file';
      const ackMsg = `Received your document *${fileNameDisplay}*. Our team will verify and process it.`;
      await this.sendAndRecordReply(
        conversation.id,
        from,
        ackMsg,
        phoneNumberId,
      );
      return;
    }

    // 2. Security guardrail: Cross-client inquiries
    if (
      lower.includes('other client') ||
      lower.includes('another client') ||
      lower.includes('someone else') ||
      lower.includes('dusre ka')
    ) {
      const refusal = 'Sorry, I can only help with your own account details.';
      await this.chatsService.setStatus(conversation.id, 'escalated');
      await this.chatsService.updateConversation(conversation.id, {
        internalNotes: `[Security Flag] Cross-client data query attempt: "${text}"`,
      });
      await this.sendAndRecordReply(
        conversation.id,
        from,
        refusal,
        phoneNumberId,
      );
      return;
    }

    // 3. Security guardrail: Account data changes
    if (
      lower.includes('change my phone') ||
      lower.includes('update my email') ||
      lower.includes('change my bank') ||
      lower.includes('delete my data')
    ) {
      const changeRefusal =
        "For security, account changes can't be made via chat. I've noted this for our team to follow up with you.";
      await this.chatsService.setStatus(conversation.id, 'escalated');
      await this.chatsService.updateConversation(conversation.id, {
        internalNotes: `[Account Update Request] Client requested: "${text}"`,
      });
      await this.sendAndRecordReply(
        conversation.id,
        from,
        changeRefusal,
        phoneNumberId,
      );
      return;
    }

    // 4. Menu Triggers ("menu", "hi", "hello", "namaste", "start", "options", "help", "helo")
    if (this.isMenuTrigger(lower)) {
      await this.sendMenu(conversation.id, from, user, phoneNumberId);
      return;
    }

    // 5. Option 1: Upload Documents ("1", "upload", "upload_docs", "upload documents")
    if (
      lower === '1' ||
      lower === 'upload' ||
      lower === 'upload_docs' ||
      lower === 'upload documents' ||
      lower.includes('upload doc')
    ) {
      const uploadToken = this.jwtService.sign(
        { sub: user.id, type: 'user', email: user.email },
        { expiresIn: '7d' },
      );
      const uploadUrl = `https://app.snbajaj.com/documents/upload?token=${uploadToken}`;
      const reply = `You can securely upload your documents directly here:\n${uploadUrl}\n\nOr you can simply send the photos or PDFs right here in this chat.`;
      await this.sendAndRecordReply(
        conversation.id,
        from,
        reply,
        phoneNumberId,
      );
      return;
    }

    // 6. Option 2: Check Pending Documents ("2", "check_pending", "pending", "pending docs")
    if (
      lower === '2' ||
      lower === 'check_pending' ||
      lower === 'pending' ||
      lower.includes('pending doc') ||
      lower.includes('due doc')
    ) {
      await this.handlePendingDocuments(
        conversation.id,
        from,
        user,
        phoneNumberId,
      );
      return;
    }

    // 7. Option 3: Request a Document ("3", "request_doc", "send my gst certificate", "itr return", etc.)
    if (
      lower === '3' ||
      lower === 'request_doc' ||
      lower.includes('certificate') ||
      lower.includes('cert') ||
      lower.includes('send my return') ||
      lower.includes('itr return') ||
      lower.includes('send return') ||
      lower.includes('request doc')
    ) {
      await this.handleDocumentRequest(
        conversation.id,
        from,
        user,
        text,
        lower,
        phoneNumberId,
      );
      return;
    }

    // 8. Option 4: Payment Status ("4", "payment_status", "payment", "how much do i owe", "dues", "kitna baki")
    if (
      lower === '4' ||
      lower === 'payment_status' ||
      lower.includes('how much do i owe') ||
      lower.includes('dues') ||
      lower.includes('payment') ||
      lower.includes('kitna baki') ||
      lower.includes('tax due')
    ) {
      await this.handlePaymentStatus(
        conversation.id,
        from,
        user,
        phoneNumberId,
      );
      return;
    }

    // 9. Option 5: Talk to our team ("5", "talk_to_team", "talk", "human", "agent", "speak to staff")
    if (
      lower === '5' ||
      lower === 'talk_to_team' ||
      lower.includes('talk to team') ||
      lower.includes('talk to our team') ||
      lower.includes('human') ||
      lower.includes('speak to staff') ||
      lower.includes('connect to agent') ||
      lower === 'ca'
    ) {
      await this.chatsService.takeover(conversation.id, 'system-takeover');
      await this.chatsService.updateConversation(conversation.id, {
        internalNotes: `[Staff Takeover] Client requested human assistance: "${text}"`,
      });
      const takeoverReply =
        "I've connected you to our team. An executive from S N Bajaj & Co will message you here shortly.";
      await this.sendAndRecordReply(
        conversation.id,
        from,
        takeoverReply,
        phoneNumberId,
      );
      return;
    }

    // 10. General Questions & Tax Inquiry: Brain (Groq AI + 11-section Knowledge Base)
    await this.handleGeneralAiInquiry(
      conversation.id,
      from,
      user,
      text,
      messageId,
      phoneNumberId,
    );
  }

  private isMenuTrigger(text: string): boolean {
    const triggers = [
      'hi',
      'hello',
      'hey',
      'namaste',
      'menu',
      'options',
      'start',
      'help',
      'helo',
    ];
    return triggers.includes(text) || text === '0';
  }

  /**
   * Sends the 5-option interactive list or clean formatted text menu.
   */
  private async sendMenu(
    conversationId: string,
    from: string,
    user: User,
    phoneNumberId?: string,
  ): Promise<void> {
    const textMenu =
      `Namaste! Welcome to *S N Bajaj & Co*. How can we assist you today?\n\n` +
      `1️⃣ *Upload documents* (send bills & statements)\n` +
      `2️⃣ *Check pending documents*\n` +
      `3️⃣ *Request a document* (GST cert, ITR, filed returns)\n` +
      `4️⃣ *Payment status* (tax dues & advisory)\n` +
      `5️⃣ *Talk to our team*\n\n` +
      `Reply with the number (e.g. *1*) or type your question.`;

    // Try interactive list first
    const interactiveSent =
      await this.notificationsService.sendWhatsappInteractiveList(
        from,
        'S N Bajaj & Co',
        `Namaste ${user.name ? user.name.split(' ')[0] : ''}! How can we assist you today?`,
        'Select Option',
        [
          {
            title: 'Client Services',
            rows: [
              {
                id: 'upload_docs',
                title: 'Upload documents',
                description: 'Send bills & bank statements',
              },
              {
                id: 'check_pending',
                title: 'Check pending docs',
                description: 'See required documents',
              },
              {
                id: 'request_doc',
                title: 'Request a document',
                description: 'GST cert, ITR, filed returns',
              },
              {
                id: 'payment_status',
                title: 'Payment status',
                description: 'Check tax dues & payment',
              },
              {
                id: 'talk_to_team',
                title: 'Talk to our team',
                description: 'Connect with staff',
              },
            ],
          },
        ],
        phoneNumberId,
      );

    if (interactiveSent) {
      await this.chatsService.recordOutboundAiMessage(
        conversationId,
        '[Interactive Menu Sent]',
      );
    } else {
      await this.sendAndRecordReply(
        conversationId,
        from,
        textMenu,
        phoneNumberId,
      );
    }
  }

  /**
   * Option 2: Pending documents lookup strictly for client_id.
   */
  private async handlePendingDocuments(
    conversationId: string,
    from: string,
    user: User,
    phoneNumberId?: string,
  ): Promise<void> {
    const pendingTasks = await this.taskRepo.find({
      where: { user_id: user.id, status: TaskStatus.PENDING },
      order: { due_date: 'ASC' },
    });

    // Filter out GST payment task since that's a payment, not a document
    const docTasks = pendingTasks.filter(
      (t) => t.category !== ComplianceCategory.GST_PAYMENT,
    );

    if (docTasks.length === 0) {
      const msg =
        'All documents for your active filing period have been received. Thank you!';
      await this.sendAndRecordReply(conversationId, from, msg, phoneNumberId);
      return;
    }

    const taskLabels: Record<string, string> = {
      [ComplianceCategory.SALES_BILLS]: 'Sales invoices',
      [ComplianceCategory.PURCHASE_BILLS]: 'Purchase bills',
      [ComplianceCategory.GSTR_1]: 'GSTR-1 data',
      [ComplianceCategory.GSTR_3B]: 'GSTR-3B data',
      [ComplianceCategory.IFF]: 'IFF data',
    };

    const bulletList = docTasks
      .map((t) => `• ${taskLabels[t.category] || t.category.replace('_', ' ')}`)
      .join('\n');

    const reply = `Here are your pending documents for this filing period:\n${bulletList}\n\nYou can upload them directly here or via the portal.`;
    await this.sendAndRecordReply(conversationId, from, reply, phoneNumberId);
  }

  /**
   * Option 3: Document request (GST certificate, Udyam, ITR return, Filed Report).
   */
  private async handleDocumentRequest(
    conversationId: string,
    from: string,
    user: User,
    originalText: string,
    lower: string,
    phoneNumberId?: string,
  ): Promise<void> {
    // 1. Generic trigger ("3", "request_doc", "request a document")
    if (
      lower === '3' ||
      lower === 'request_doc' ||
      lower === 'request a document'
    ) {
      const reply =
        'Which document do you need? You can ask for your *GST Certificate*, *Udyam Certificate*, *ITR Return*, or *Filed Report*.';
      await this.sendAndRecordReply(conversationId, from, reply, phoneNumberId);
      return;
    }

    let foundDoc: { s3Key: string; filename: string; title: string } | null =
      null;

    // 2. GST Certificate request
    if (lower.includes('gst cert') || lower.includes('gst certificate')) {
      const cert = await this.certRepo.findOne({
        where: { user_id: user.id, cert_type: CertType.GST_CERT },
      });
      if (cert) {
        foundDoc = {
          s3Key: cert.s3_key,
          filename: cert.original_filename || 'GST_Certificate.pdf',
          title: 'GST Certificate',
        };
      }
    }
    // 3. Udyam / MSME Certificate request
    else if (lower.includes('udyam') || lower.includes('msme')) {
      const cert = await this.certRepo.findOne({
        where: { user_id: user.id, cert_type: CertType.UDYAM_CERT },
      });
      if (cert) {
        foundDoc = {
          s3Key: cert.s3_key,
          filename: cert.original_filename || 'Udyam_Certificate.pdf',
          title: 'Udyam Certificate',
        };
      }
    }
    // 4. ITR Return request
    else if (lower.includes('itr') || lower.includes('return')) {
      const ret = await this.itrRepo.findOne({
        where: { user_id: user.id },
        order: { assessment_year: 'DESC' },
      });
      if (ret) {
        foundDoc = {
          s3Key: ret.s3_key,
          filename:
            ret.original_filename || `ITR_Return_AY_${ret.assessment_year}.pdf`,
          title: `ITR Return (AY ${ret.assessment_year})`,
        };
      }
    }
    // 5. CA Filed Report
    else if (lower.includes('report') || lower.includes('filed')) {
      const report = await this.reportRepo.findOne({
        where: { user_id: user.id },
        order: { sent_at: 'DESC' },
      });
      if (report) {
        foundDoc = {
          s3Key: report.s3_key,
          filename: report.original_filename || 'Filing_Report.pdf',
          title: 'Filed Return Report',
        };
      }
    }

    if (foundDoc) {
      const downloadUrl = await this.storage.createAttachmentDownloadUrl(
        foundDoc.s3Key,
        foundDoc.filename,
        300,
      );

      // Attempt sending as WhatsApp document attachment
      const sentDoc = await this.notificationsService.sendWhatsappDocument(
        from,
        downloadUrl,
        foundDoc.filename,
        `Here is your ${foundDoc.title}`,
        phoneNumberId,
      );

      if (sentDoc) {
        await this.chatsService.recordOutboundAiMessage(
          conversationId,
          `[Document Sent: ${foundDoc.title}]`,
        );
      } else {
        // Fallback to sending download link directly in text message
        const linkMsg = `Here is your *${foundDoc.title}*:\n${downloadUrl}\n\n(Link is valid for 5 minutes).`;
        await this.sendAndRecordReply(
          conversationId,
          from,
          linkMsg,
          phoneNumberId,
        );
      }
      return;
    }

    // Not found in client's vault → escalate to staff and politely notify client
    await this.chatsService.setStatus(conversationId, 'escalated');
    await this.chatsService.updateConversation(conversationId, {
      internalNotes: `[Document Requested] Client asked for "${originalText}" but file was not found in vault.`,
    });

    const notFoundReply =
      "I couldn't find a filed copy of that document on your account. I've flagged this for our team, and someone will send it to you shortly.";
    await this.sendAndRecordReply(
      conversationId,
      from,
      notFoundReply,
      phoneNumberId,
    );
  }

  /**
   * Option 4: Payment status lookup strictly from DB. Never invent figures.
   */
  private async handlePaymentStatus(
    conversationId: string,
    from: string,
    user: User,
    phoneNumberId?: string,
  ): Promise<void> {
    const paymentTask = await this.taskRepo.findOne({
      where: {
        user_id: user.id,
        category: ComplianceCategory.GST_PAYMENT,
      },
      order: { created_at: 'DESC' },
    });

    if (paymentTask) {
      if (paymentTask.status === TaskStatus.COMPLETED || paymentTask.paid_at) {
        const msg = `You have no pending tax dues. Your payment of *₹${paymentTask.amount || '0'}* has been confirmed.`;
        await this.sendAndRecordReply(conversationId, from, msg, phoneNumberId);
        return;
      }

      if (paymentTask.status === TaskStatus.PENDING && paymentTask.amount) {
        const msg = `Your tax payment due for this period is *₹${paymentTask.amount}*.`;
        await this.sendAndRecordReply(conversationId, from, msg, phoneNumberId);
        return;
      }

      if (paymentTask.status === TaskStatus.PENDING && !paymentTask.amount) {
        const msg =
          "Your tax computation for this period is currently being finalized by our team. We'll update you as soon as the figures are ready.";
        await this.sendAndRecordReply(conversationId, from, msg, phoneNumberId);
        return;
      }
    }

    const noDuesMsg =
      'There are no pending tax dues recorded on your account for this period.';
    await this.sendAndRecordReply(
      conversationId,
      from,
      noDuesMsg,
      phoneNumberId,
    );
  }

  /**
   * General inquiries routed to Groq AI brain with 11-section Knowledge Base.
   */
  private async handleGeneralAiInquiry(
    conversationId: string,
    from: string,
    user: User,
    text: string,
    messageId: string,
    phoneNumberId?: string,
  ): Promise<void> {
    // 1. Fetch recent conversation memory for context
    const recentDbMessages = await this.chatsService.getMessages(
      conversationId,
      6,
    );
    const history = recentDbMessages.map((m) => ({
      sender: m.sender,
      body: m.body || '',
    }));

    // 2. Pass strictly client-owned context (DB-verified figures only)
    const paymentTask = await this.taskRepo.findOne({
      where: {
        user_id: user.id,
        category: ComplianceCategory.GST_PAYMENT,
        status: TaskStatus.PENDING,
      },
      order: { created_at: 'DESC' },
    });

    const pendingTasks =
      (await this.taskRepo.find({
        where: {
          user_id: user.id,
          status: TaskStatus.PENDING,
        },
        take: 5,
      })) || [];
    const pendingDocs = pendingTasks
      .filter((t) => t.category !== ComplianceCategory.GST_PAYMENT)
      .map((t) => t.category);

    const clientContext = {
      clientId: user.id,
      name: user.name,
      businessName: user.business_name || undefined,
      gstin: user.gstin || undefined,
      pan: user.pan || undefined,
      userType: user.user_type,
      duesAmount: paymentTask?.amount ? `₹${paymentTask.amount}` : undefined,
      pendingDocs: pendingDocs.length > 0 ? pendingDocs : undefined,
    };

    // 3. Generate response via Groq AI
    const result = await this.whatsappAiService.generateReply(
      from,
      messageId,
      text,
      clientContext,
      history,
    );

    if (result.reply) {
      if (result.shouldEscalate) {
        await this.chatsService.setStatus(conversationId, 'escalated');
        await this.chatsService.updateConversation(conversationId, {
          internalNotes: `[Escalation] ${result.escalationReason || 'Question required staff follow-up'}: "${text}"`,
        });
      }

      await this.sendAndRecordReply(
        conversationId,
        from,
        result.reply,
        phoneNumberId,
      );
    }
  }

  /**
   * Helper to send WhatsApp text message and record outbound in database.
   */
  private async sendAndRecordReply(
    conversationId: string,
    to: string,
    message: string,
    phoneNumberId?: string,
  ): Promise<void> {
    const sent = await this.notificationsService.sendWhatsapp(
      to,
      message,
      phoneNumberId,
    );
    if (sent) {
      await this.chatsService.recordOutboundAiMessage(conversationId, message);
    } else {
      this.logger.warn(`Failed to deliver WhatsApp message to ${to}`);
    }
  }
}

import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DocumentCategory } from '../common/enums';
import {
  advanceFilingTaskOnUpload,
  currentAssessmentYear,
} from '../compliance-tasks/task-upload.util';
import {
  ComplianceTask,
  Document,
  GstFilingPeriod,
  User,
  WhatsappConversation,
} from '../entities';
import { WhatsappChatsService } from '../whatsapp-chats/whatsapp-chats.service';
import { NotificationsService } from './notifications.service';

/** Interactive reply ids used by the "what are these files?" flow. */
export const UPLOAD_REPLY = {
  gst: 'wa_cls_gst',
  itr: 'wa_cls_itr',
  other: 'wa_cls_other',
  periodPrefix: 'wa_period_',
} as const;

/** How long an unanswered "what are these files?" question stays open. */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

interface Batch {
  userId: string;
  documentIds: string[];
  from: string;
  phoneNumberId?: string;
  timer: NodeJS.Timeout;
}

/**
 * Files a registered client sends on WhatsApp (photos, PDFs, sheets).
 *
 * Each file is saved immediately (S3 + `documents`, unassigned) so the CA can
 * see it right away. Files arriving close together are batched; once the
 * client stops sending, the bot asks ONE question — GST / ITR / something
 * else — and, for GST, which open filing month. The answer files the batch
 * (and advances that month's compliance task, same as an app upload).
 */
@Injectable()
export class WhatsappUploadsService implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsappUploadsService.name);
  private readonly batches = new Map<string, Batch>();

  constructor(
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    @Inject(forwardRef(() => WhatsappChatsService))
    private readonly chats: WhatsappChatsService,
    @InjectRepository(Document)
    private readonly docRepo: Repository<Document>,
    @InjectRepository(ComplianceTask)
    private readonly taskRepo: Repository<ComplianceTask>,
    @InjectRepository(GstFilingPeriod)
    private readonly periodRepo: Repository<GstFilingPeriod>,
  ) {}

  onModuleDestroy(): void {
    for (const batch of this.batches.values()) clearTimeout(batch.timer);
    this.batches.clear();
  }

  private batchDelayMs(): number {
    const seconds = this.config.get<number>('whatsapp.uploadBatchSeconds');
    return (typeof seconds === 'number' && seconds >= 0 ? seconds : 20) * 1000;
  }

  /** Queue a just-saved document; the question goes out after a quiet gap. */
  addFile(
    conversationId: string,
    user: User,
    documentId: string,
    from: string,
    phoneNumberId?: string,
  ): void {
    const existing = this.batches.get(conversationId);
    if (existing) clearTimeout(existing.timer);
    const batch: Batch = {
      userId: user.id,
      documentIds: [...(existing?.documentIds ?? []), documentId],
      from,
      phoneNumberId,
      timer: setTimeout(
        () => void this.flush(conversationId),
        this.batchDelayMs(),
      ),
    };
    this.batches.set(conversationId, batch);
  }

  /** Sends the classification question for everything collected so far. */
  async flush(conversationId: string): Promise<void> {
    const batch = this.batches.get(conversationId);
    if (!batch) return;
    this.batches.delete(conversationId);
    clearTimeout(batch.timer);

    try {
      const conv = await this.chats.findConversation(conversationId);
      // An earlier unanswered batch is merged so one answer covers all files
      const previous = this.activePending(conv);
      const documentIds = [
        ...(previous?.documentIds ?? []),
        ...batch.documentIds,
      ];
      await this.chats.setPendingUpload(conversationId, {
        documentIds,
        step: 'ask_type',
        expiresAt: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
      });

      const count = documentIds.length;
      const body =
        count === 1
          ? 'Got your file 👍 What is this file for?'
          : `Got ${count} files 👍 What are these files for?`;
      const sent = await this.notifications.sendWhatsappButtons(
        batch.from,
        body,
        [
          { id: UPLOAD_REPLY.gst, title: 'GST documents' },
          { id: UPLOAD_REPLY.itr, title: 'ITR documents' },
          { id: UPLOAD_REPLY.other, title: 'Something else' },
        ],
        batch.phoneNumberId,
      );
      if (sent) {
        await this.chats.recordOutboundAiMessage(
          conversationId,
          `${body}\n[GST documents] [ITR documents] [Something else]`,
        );
      } else {
        await this.reply(
          conversationId,
          batch.from,
          `${body} Reply *GST*, *ITR* or *Other*.`,
          batch.phoneNumberId,
        );
      }
    } catch (err) {
      this.logger.error(
        `Upload classification prompt failed for ${conversationId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Handles the client's answer to a pending question. Returns true when the
   * message was consumed (so the normal bot flow should not also answer it).
   */
  async handleAnswer(
    conversation: WhatsappConversation,
    user: User,
    from: string,
    text: string,
    phoneNumberId?: string,
  ): Promise<boolean> {
    const pending = this.activePending(conversation);
    if (!pending) return false;
    const lower = text.trim().toLowerCase();

    if (pending.step === 'ask_type') {
      if (
        lower === UPLOAD_REPLY.gst ||
        lower === 'gst' ||
        lower === 'gst documents'
      ) {
        await this.askPeriod(
          conversation,
          user,
          from,
          pending.documentIds,
          phoneNumberId,
        );
        return true;
      }
      if (
        lower === UPLOAD_REPLY.itr ||
        lower === 'itr' ||
        lower === 'itr documents'
      ) {
        const ay = currentAssessmentYear();
        await this.docRepo.update(
          { id: In(pending.documentIds), user_id: user.id },
          { category: DocumentCategory.ITR, assessment_year: ay },
        );
        await this.chats.setPendingUpload(conversation.id, null);
        await this.reply(
          conversation.id,
          from,
          `Thanks, ${this.countText(pending.documentIds.length)} saved under your ITR documents (AY ${ay}). Our team will review them.`,
          phoneNumberId,
        );
        return true;
      }
      if (
        lower === UPLOAD_REPLY.other ||
        lower === 'other' ||
        lower === 'something else'
      ) {
        await this.chats.setPendingUpload(conversation.id, null);
        await this.chats.setStatus(conversation.id, 'escalated');
        await this.chats.updateConversation(conversation.id, {
          internalNotes: this.appendNote(
            conversation.internalNotes,
            `[Files to review] Client sent ${pending.documentIds.length} file(s) marked "something else" on ${new Date().toLocaleDateString('en-IN')}.`,
          ),
        });
        await this.reply(
          conversation.id,
          from,
          "Okay, I've passed these to our team. Someone will look at them and get back to you.",
          phoneNumberId,
        );
        return true;
      }
      return false;
    }

    if (
      pending.step === 'ask_period' &&
      lower.startsWith(UPLOAD_REPLY.periodPrefix)
    ) {
      const periodId = text.trim().slice(UPLOAD_REPLY.periodPrefix.length);
      const period = await this.periodRepo.findOne({ where: { id: periodId } });
      if (!period) return false;
      await this.fileUnderPeriod(
        conversation,
        user,
        from,
        pending.documentIds,
        period,
        phoneNumberId,
      );
      return true;
    }
    return false;
  }

  private async askPeriod(
    conversation: WhatsappConversation,
    user: User,
    from: string,
    documentIds: string[],
    phoneNumberId?: string,
  ): Promise<void> {
    const periods = await this.periodRepo.find({
      where: { is_open: true },
      order: { due_date: 'DESC' },
      take: 10,
    });

    if (periods.length === 0) {
      await this.docRepo.update(
        { id: In(documentIds), user_id: user.id },
        { category: DocumentCategory.GST },
      );
      await this.chats.setPendingUpload(conversation.id, null);
      await this.reply(
        conversation.id,
        from,
        `Thanks, ${this.countText(documentIds.length)} saved as GST documents. Our team will link them to the right month.`,
        phoneNumberId,
      );
      return;
    }
    if (periods.length === 1) {
      await this.fileUnderPeriod(
        conversation,
        user,
        from,
        documentIds,
        periods[0],
        phoneNumberId,
      );
      return;
    }

    await this.chats.setPendingUpload(conversation.id, {
      documentIds,
      step: 'ask_period',
      expiresAt: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
    });
    const body = 'Which month are these GST documents for?';
    const sent = await this.notifications.sendWhatsappInteractiveList(
      from,
      'GST filing month',
      body,
      'Choose month',
      [
        {
          title: 'Open months',
          rows: periods.map((p) => ({
            id: `${UPLOAD_REPLY.periodPrefix}${p.id}`,
            title: p.period_label.slice(0, 24),
          })),
        },
      ],
      phoneNumberId,
    );
    if (sent) {
      await this.chats.recordOutboundAiMessage(
        conversation.id,
        `${body}\n${periods.map((p) => `• ${p.period_label}`).join('\n')}`,
      );
    } else {
      // Without the list we can't take the answer reliably; file under the
      // latest open month and let staff correct it if needed.
      await this.fileUnderPeriod(
        conversation,
        user,
        from,
        documentIds,
        periods[0],
        phoneNumberId,
      );
    }
  }

  private async fileUnderPeriod(
    conversation: WhatsappConversation,
    user: User,
    from: string,
    documentIds: string[],
    period: GstFilingPeriod,
    phoneNumberId?: string,
  ): Promise<void> {
    await this.docRepo.update(
      { id: In(documentIds), user_id: user.id },
      { category: DocumentCategory.GST, filing_period_id: period.id },
    );
    await advanceFilingTaskOnUpload(this.taskRepo, user.id, period.id);
    await this.chats.setPendingUpload(conversation.id, null);
    await this.reply(
      conversation.id,
      from,
      `Thanks, ${this.countText(documentIds.length)} saved for *${period.period_label}* GST. Our team will review them.`,
      phoneNumberId,
    );
  }

  private activePending(
    conv: WhatsappConversation | null,
  ): WhatsappConversation['pendingUpload'] {
    const pending = conv?.pendingUpload;
    if (!pending || pending.documentIds.length === 0) return null;
    if (new Date(pending.expiresAt).getTime() < Date.now()) return null;
    return pending;
  }

  private countText(n: number): string {
    return n === 1 ? 'your file is' : `all ${n} files are`;
  }

  private appendNote(existing: string | null, note: string): string {
    return existing ? `${existing}\n${note}` : note;
  }

  private async reply(
    conversationId: string,
    to: string,
    message: string,
    phoneNumberId?: string,
  ): Promise<void> {
    const sent = await this.notifications.sendWhatsapp(
      to,
      message,
      phoneNumberId,
    );
    if (sent) {
      await this.chats.recordOutboundAiMessage(conversationId, message);
    } else {
      this.logger.warn(`Failed to deliver WhatsApp message to ${to}`);
    }
  }
}

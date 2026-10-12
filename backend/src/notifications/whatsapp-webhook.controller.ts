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
import type { Request, Response } from 'express';
import { NotificationsService } from './notifications.service';
import { WhatsappAiService } from './whatsapp-ai.service';
import { WhatsappMediaService } from './whatsapp-media.service';
import { WhatsappChatsService } from '../whatsapp-chats/whatsapp-chats.service';
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
    @Inject(forwardRef(() => WhatsappChatsService))
    private readonly chatsService: WhatsappChatsService,
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
            void (async () => {
              try {
                let msgType: WhatsappMessageType = 'text';
                let msgBody: string | undefined = undefined;
                let mediaUrl: string | undefined = undefined;

                if (message.type === 'text' && message.text?.body) {
                  msgType = 'text';
                  msgBody = message.text.body;
                } else if (message.type === 'image' && message.image) {
                  msgType = 'image';
                  msgBody = message.image.caption || '[Image received]';
                  const stored = await this.mediaService.processAndStoreMedia(
                    message.image.id,
                    message.image.mime_type,
                  );
                  if (stored) mediaUrl = stored;
                } else if (message.type === 'document' && message.document) {
                  msgType = 'document';
                  const name = message.document.filename || 'Document';
                  msgBody = message.document.caption
                    ? `${name}: ${message.document.caption}`
                    : `[Document: ${name}]`;
                  const stored = await this.mediaService.processAndStoreMedia(
                    message.document.id,
                    message.document.mime_type,
                    message.document.filename,
                  );
                  if (stored) mediaUrl = stored;
                } else if (message.type === 'audio' && message.audio) {
                  msgType = 'audio';
                  msgBody = '[Voice note / Audio received]';
                  const stored = await this.mediaService.processAndStoreMedia(
                    message.audio.id,
                    message.audio.mime_type,
                  );
                  if (stored) mediaUrl = stored;
                } else {
                  msgType = 'text';
                  msgBody = `[Unsupported message type: ${message.type || 'unknown'}]`;
                }

                // 1. Record inbound message in DB with deduplication
                const recordResult = await this.chatsService.recordInboundMessage({
                  phoneNumber: from,
                  profileName: contactName,
                  metaMessageId: messageId,
                  messageType: msgType,
                  body: msgBody,
                  mediaUrl: mediaUrl,
                });

                if (recordResult.isDuplicate) {
                  this.logger.debug(
                    `Inbound message ${messageId} is duplicate; skipping AI generation.`,
                  );
                  return;
                }

                const conversation = recordResult.conversation;

                // 2. Check conversation status - AI SUPPRESSION RULE
                if (
                  conversation.status === 'staff_takeover' ||
                  conversation.status === 'closed'
                ) {
                  this.logger.log(
                    `Conversation ${conversation.id} is in "${conversation.status}" status. AI reply suppressed.`,
                  );
                  return;
                }

                // 3. For AI-handling conversations, generate reply
                this.logger.log(
                  `Incoming WhatsApp message on phone ID ${phoneNumberId} from ${from} (ID: ${messageId}): "${msgBody}"`,
                );

                const promptText =
                  msgType === 'text' && msgBody
                    ? msgBody
                    : `[The client sent a file: ${msgBody}]. Please acknowledge receipt of the document politely on behalf of S N Bajaj And Co and ask how we can assist them.`;

                const aiReply = await this.whatsappAiService.generateReply(
                  from,
                  messageId,
                  promptText,
                );

                if (aiReply) {
                  this.logger.log(
                    `Sending single AI reply to ${from} via phone ID ${phoneNumberId}`,
                  );

                  // Send 1 single reply bubble via Meta Cloud API
                  const sent = await this.notificationsService.sendWhatsapp(
                    from,
                    aiReply,
                    phoneNumberId,
                  );

                  if (sent) {
                    // Record outbound AI reply in DB
                    await this.chatsService.recordOutboundAiMessage(
                      conversation.id,
                      aiReply,
                    );
                    this.logger.log(`AI reply successfully sent and recorded for ${from}`);
                  } else {
                    this.logger.warn(`Failed to deliver AI reply to ${from}`);
                  }
                }
              } catch (err) {
                this.logger.error(
                  `Error processing WhatsApp message for ${from}: ${(err as Error).message}`,
                  (err as Error).stack,
                );
              }
            })();
          }
        }
      }
    }
  }
}


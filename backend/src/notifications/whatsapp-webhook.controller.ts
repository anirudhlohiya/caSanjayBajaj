import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { NotificationsService } from './notifications.service';
import { WhatsappAiService } from './whatsapp-ai.service';

interface WhatsappIncomingMessage {
  from: string;
  id: string;
  timestamp?: string;
  type?: string;
  text?: { body: string };
}

interface WhatsappWebhookBody {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        messages?: WhatsappIncomingMessage[];
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

    // Acknowledge Meta immediately with 200 OK
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

          for (const message of value.messages) {
            const from = message.from;
            const messageId = message.id;
            const msgBody = message.text?.body;

            if (!from || !msgBody) {
              continue;
            }

            this.logger.log(
              `Incoming WhatsApp message on number ID ${phoneNumberId} from ${from} (ID: ${messageId}): "${msgBody}"`,
            );

            // Process message and send AI reply asynchronously
            void (async () => {
              try {
                const aiReply = await this.whatsappAiService.generateReply(
                  from,
                  messageId,
                  msgBody,
                );

                if (aiReply) {
                  this.logger.log(
                    `Sending AI reply to ${from} via phone ID ${phoneNumberId}`,
                  );
                  const sent = await this.notificationsService.sendWhatsapp(
                    from,
                    aiReply,
                    phoneNumberId,
                  );
                  if (sent) {
                    this.logger.log(`AI reply successfully sent to ${from}`);
                  } else {
                    this.logger.warn(`Failed to deliver AI reply to ${from}`);
                  }
                }
              } catch (err) {
                this.logger.error(
                  `Error processing WhatsApp AI reply for ${from}: ${(err as Error).message}`,
                );
              }
            })();
          }
        }
      }
    }
  }
}

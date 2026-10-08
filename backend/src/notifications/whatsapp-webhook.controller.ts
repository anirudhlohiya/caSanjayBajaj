import { Controller, Get, Post, Req, Res, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

@Controller('notifications/whatsapp-webhook')
export class WhatsappWebhookController {
  constructor(private readonly configService: ConfigService) { }

  @Get()
  verifyWebhook(@Req() req: Request, @Res() res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = this.configService.get<string>('whatsapp.verifyToken');

    if (mode && token) {
      if (mode === 'subscribe' && token === verifyToken) {
        console.log('WEBHOOK_VERIFIED');
        return res.status(HttpStatus.OK).send(challenge);
      } else {
        return res.sendStatus(HttpStatus.FORBIDDEN);
      }
    }

    return res.sendStatus(HttpStatus.BAD_REQUEST);
  }

  @Post()
  handleWebhook(@Req() req: Request, @Res() res: Response) {
    interface WhatsappWebhookBody {
      object?: string;
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: Array<{
              from: string;
              text?: { body: string };
            }>;
            metadata?: { phone_number_id: string };
          };
        }>;
      }>;
    }

    const body = req.body as WhatsappWebhookBody;

    console.log('Incoming WhatsApp Webhook:', JSON.stringify(body, null, 2));

    if (body.object) {
      if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0] &&
        body.entry[0].changes[0].value?.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        // A message was received
        const phoneNumberId = body.entry[0].changes[0].value.metadata?.phone_number_id;
        const from = body.entry[0].changes[0].value.messages[0].from;
        const msgBody = body.entry[0].changes[0].value.messages[0].text?.body;

        console.log(`Received message from ${from}: ${msgBody} on number ID ${phoneNumberId}`);
      }

      // Always return a 200 OK to acknowledge receipt
      return res.sendStatus(HttpStatus.OK);
    } else {
      return res.sendStatus(HttpStatus.NOT_FOUND);
    }
  }
}

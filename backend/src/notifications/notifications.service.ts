import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import webpush from 'web-push';

export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function isPushSubscription(value: unknown): value is PushSubscription {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const keys = v.keys as Record<string, unknown> | undefined;
  return (
    typeof v.endpoint === 'string' &&
    !!keys &&
    typeof keys.p256dh === 'string' &&
    typeof keys.auth === 'string'
  );
}

export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
}

export interface EmailRecipient {
  email: string;
  name?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly ses: SESv2Client;
  private readonly sourceName: string;
  private readonly sourceEmail: string;
  private readonly vapidConfigured: boolean;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    this.sourceEmail = this.config.get<string>('ses.sourceEmail') ?? '';
    this.sourceName = this.config.get<string>('ses.sourceName') ?? '';

    this.ses = new SESv2Client({
      region: this.config.get('aws.region'),
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('aws.accessKeyId'),
        secretAccessKey: this.config.getOrThrow<string>('aws.secretAccessKey'),
      },
    });

    const publicKey = this.config.get<string>('firebase.vapidPublicKey') ?? '';
    const privateKey =
      this.config.get<string>('firebase.vapidPrivateKey') ?? '';
    const subject =
      this.config.get<string>('firebase.vapidSubject') ??
      'mailto:admin@example.com';
    this.vapidConfigured = Boolean(publicKey && privateKey);
    if (this.vapidConfigured) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
    }
  }

  async sendEmail(
    to: EmailRecipient,
    subject: string,
    htmlBody: string,
  ): Promise<boolean> {
    if (!this.sourceEmail) {
      this.logger.warn(
        `SES source email not configured; skipping email to ${to.email}`,
      );
      return false;
    }
    const emailLower = to.email.toLowerCase();
    try {
      const existing = await this.users.findOne({
        where: { email: emailLower },
      });
      if (existing?.email_suppressed_at) {
        this.logger.warn(
          `Skipping email to suppressed recipient ${emailLower}`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error(
        `Suppression check failed for ${emailLower}: ${(error as Error).message}`,
      );
    }
    try {
      const command = new SendEmailCommand({
        FromEmailAddress: `${this.sourceName} <${this.sourceEmail}>`,
        Destination: { ToAddresses: [to.email] },
        Content: {
          Simple: {
            Subject: { Data: subject },
            Body: { Html: { Data: htmlBody } },
          },
        },
      });
      await this.ses.send(command);
      return true;
    } catch (error) {
      this.logger.error(`SES send failed: ${(error as Error).message}`);
      return false;
    }
  }

  async sendPush(
    subscription: PushSubscription,
    payload: NotificationPayload,
  ): Promise<boolean> {
    if (!this.vapidConfigured) {
      this.logger.warn('VAPID keys not configured; skipping push');
      return false;
    }
    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({ ...payload, url: payload.url ?? '/' }),
        { TTL: 86400 },
      );
      return true;
    } catch (error) {
      this.logger.error(`Push send failed: ${(error as Error).message}`);
      return false;
    }
  }

  async sendWhatsapp(toPhoneNumber: string, message: string): Promise<boolean> {
    const phoneNumberId = this.config.get<string>('whatsapp.phoneNumberId');
    const accessToken = this.config.get<string>('whatsapp.accessToken');

    if (!phoneNumberId || !accessToken) {
      this.logger.warn(
        'WhatsApp configuration missing; skipping WhatsApp message',
      );
      return false;
    }

    try {
      // Remove any non-numeric characters from the phone number
      let cleanNumber = toPhoneNumber.replace(/\D/g, '');
      if (cleanNumber.length === 10) {
        cleanNumber = '91' + cleanNumber;
      }
      const response = await fetch(
        `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: cleanNumber,
            type: 'text',
            text: {
              body: message,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error(
          `WhatsApp send failed for ${toPhoneNumber}: ${JSON.stringify(errorData)}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `WhatsApp send failed for ${toPhoneNumber}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  async sendWhatsappTemplate(
    toPhoneNumber: string,
    templateName: string,
    languageCode: string = 'en_US',
  ): Promise<boolean> {
    const phoneNumberId = this.config.get<string>('whatsapp.phoneNumberId');
    const accessToken = this.config.get<string>('whatsapp.accessToken');

    if (!phoneNumberId || !accessToken) {
      this.logger.warn(
        'WhatsApp configuration missing; skipping WhatsApp template',
      );
      return false;
    }

    try {
      let cleanNumber = toPhoneNumber.replace(/\D/g, '');
      if (cleanNumber.length === 10) {
        cleanNumber = '91' + cleanNumber;
      }
      const response = await fetch(
        `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: cleanNumber,
            type: 'template',
            template: {
              name: templateName,
              language: {
                code: languageCode,
              },
            },
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error(
          `WhatsApp template send failed for ${toPhoneNumber}: ${JSON.stringify(errorData)}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `WhatsApp template send failed for ${toPhoneNumber}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  health(): { ses: boolean; push: boolean; whatsapp: boolean } {
    return {
      ses: Boolean(this.sourceEmail),
      push: this.vapidConfigured,
      whatsapp: Boolean(
        this.config.get<string>('whatsapp.phoneNumberId') &&
          this.config.get<string>('whatsapp.accessToken'),
      ),
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readFileSync } from 'node:fs';
import { App, cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { DevicePlatform } from '../common/enums';
import { DeviceToken } from '../entities/device-token.entity';
import { User } from '../entities/user.entity';
import webpush from 'web-push';
import {
  WHATSAPP_TEMPLATE_DEFAULTS,
  WhatsappTemplateDef,
  WhatsappTemplateKey,
} from './whatsapp-templates';

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
    @InjectRepository(DeviceToken)
    private readonly deviceTokens: Repository<DeviceToken>,
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

  /**
   * Push to every device a client has registered: browsers / PWA via web
   * push, the Android app via Firebase Cloud Messaging. Devices that are gone
   * (uninstalled app, expired subscription) are removed. True if any device
   * received it.
   */
  async pushToUser(
    userId: string,
    payload: NotificationPayload,
  ): Promise<boolean> {
    const tokens = await this.deviceTokens.find({ where: { user_id: userId } });
    let delivered = false;
    const stale: string[] = [];
    for (const token of tokens) {
      const result =
        token.platform === DevicePlatform.ANDROID
          ? await this.sendFcm(token.push_token, payload)
          : await this.sendWebPush(token.push_token, payload);
      if (result === 'sent') delivered = true;
      if (result === 'gone') stale.push(token.id);
    }
    if (stale.length) {
      await this.deviceTokens.delete(stale);
      this.logger.log(`Removed ${stale.length} expired push token(s)`);
    }
    return delivered;
  }

  private async sendWebPush(
    rawToken: string,
    payload: NotificationPayload,
  ): Promise<'sent' | 'gone' | 'failed'> {
    let subscription: unknown;
    try {
      subscription = JSON.parse(rawToken);
    } catch {
      return 'gone';
    }
    if (!isPushSubscription(subscription)) return 'gone';
    if (!this.vapidConfigured) return 'failed';
    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({ ...payload, url: payload.url ?? '/' }),
        { TTL: 86400 },
      );
      return 'sent';
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return 'gone';
      this.logger.error(`Push send failed: ${(error as Error).message}`);
      return 'failed';
    }
  }

  private firebaseApp: App | null | undefined;

  /** Firebase app for FCM, created on first use; null when not configured. */
  private firebase(): App | null {
    if (this.firebaseApp !== undefined) return this.firebaseApp;
    const path = this.config.get<string>('firebase.serviceAccountPath');
    if (!path) {
      this.firebaseApp = null;
      return null;
    }
    try {
      const account = JSON.parse(readFileSync(path, 'utf8')) as {
        project_id: string;
        client_email: string;
        private_key: string;
      };
      this.firebaseApp = initializeApp(
        {
          credential: cert({
            projectId: account.project_id,
            clientEmail: account.client_email,
            privateKey: account.private_key,
          }),
        },
        'fcm',
      );
    } catch (error) {
      this.logger.error(
        `Firebase service account could not be loaded: ${(error as Error).message}`,
      );
      this.firebaseApp = null;
    }
    return this.firebaseApp;
  }

  /** Android app notification via Firebase Cloud Messaging. */
  private async sendFcm(
    token: string,
    payload: NotificationPayload,
  ): Promise<'sent' | 'gone' | 'failed'> {
    const app = this.firebase();
    if (!app) return 'failed';
    try {
      await getMessaging(app).send({
        token,
        // Data-only: the app builds the notification itself so a tap can open
        // the right screen (payload.url) inside the app.
        data: {
          title: payload.title,
          body: payload.body,
          url: payload.url ?? '/',
        },
        android: { priority: 'high', ttl: 86400 * 1000 },
      });
      return 'sent';
    } catch (error) {
      const code = (error as { code?: string }).code ?? '';
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/invalid-argument'
      ) {
        return 'gone';
      }
      this.logger.error(`FCM send failed: ${(error as Error).message}`);
      return 'failed';
    }
  }

  async sendWhatsapp(
    toPhoneNumber: string,
    message: string,
    senderPhoneNumberId?: string,
  ): Promise<boolean> {
    const phoneNumberId =
      senderPhoneNumberId || this.config.get<string>('whatsapp.phoneNumberId');
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
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
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
        const errorData = (await response.json()) as {
          error?: { code?: number; message?: string };
        };
        this.logger.error(
          `WhatsApp send failed for ${toPhoneNumber}: ${JSON.stringify(errorData)}`,
        );

        if (errorData.error?.code === 131037) {
          this.logger.warn(
            `WhatsApp sender ID ${phoneNumberId} needs display name approval in Meta Business Manager before outbound messages can be delivered.`,
          );
        }

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

  /** Resolves a platform template (configured name + language + body text). */
  templateDef(key: WhatsappTemplateKey): WhatsappTemplateDef {
    const defaults = WHATSAPP_TEMPLATE_DEFAULTS[key];
    return {
      key,
      ...defaults,
      name:
        this.config.get<string>(`whatsapp.templates.${key}`) ?? defaults.name,
      language:
        this.config.get<string>('whatsapp.templateLanguage') ??
        defaults.language,
    };
  }

  async sendWhatsappTemplate(
    toPhoneNumber: string,
    templateName: string,
    languageCode: string = 'en',
    bodyParams: string[] = [],
    headerDocument?: { link: string; filename: string },
  ): Promise<boolean> {
    const phoneNumberId = this.config.get<string>('whatsapp.phoneNumberId');
    const accessToken = this.config.get<string>('whatsapp.accessToken');

    if (!phoneNumberId || !accessToken) {
      this.logger.warn(
        'WhatsApp configuration missing; skipping WhatsApp template',
      );
      return false;
    }

    const components: Array<Record<string, unknown>> = [];
    if (headerDocument) {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'document',
            document: {
              link: headerDocument.link,
              filename: headerDocument.filename,
            },
          },
        ],
      });
    }
    if (bodyParams.length > 0) {
      components.push({
        type: 'body',
        // Meta rejects empty parameter text, so blank values become a dash
        parameters: bodyParams.map((text) => ({
          type: 'text',
          text: text?.trim() ? text : '-',
        })),
      });
    }

    try {
      let cleanNumber = toPhoneNumber.replace(/\D/g, '');
      if (cleanNumber.length === 10) {
        cleanNumber = '91' + cleanNumber;
      }
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
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
              ...(components.length > 0 ? { components } : {}),
            },
          }),
        },
      );

      if (!response.ok) {
        const errorData = (await response.json()) as Record<string, unknown>;
        this.logger.error(
          `WhatsApp template ${templateName} send failed for ${toPhoneNumber}: ${JSON.stringify(errorData)}`,
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

  /**
   * Approved message templates on the WhatsApp Business Account, straight
   * from the Graph API. Returns [] when WhatsApp is not configured.
   */
  async listApprovedTemplates(): Promise<
    Array<{ name: string; language: string; category: string; body: string }>
  > {
    const businessId =
      this.config.get<string>('whatsapp.templatesAccountId') ||
      this.config.get<string>('whatsapp.businessId');
    const accessToken = this.config.get<string>('whatsapp.accessToken');
    if (!businessId || !accessToken) return [];

    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${businessId}/message_templates?status=APPROVED&limit=100&fields=name,language,category,status,components`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!response.ok) {
        const errorData = (await response.json()) as Record<string, unknown>;
        this.logger.warn(
          `WhatsApp template list failed: ${JSON.stringify(errorData)}`,
        );
        return [];
      }
      const data = (await response.json()) as {
        data?: Array<{
          name: string;
          language: string;
          category: string;
          status: string;
          components?: Array<{ type: string; text?: string }>;
        }>;
      };
      return (data.data ?? [])
        .filter((t) => t.status === 'APPROVED')
        .map((t) => ({
          name: t.name,
          language: t.language,
          category: t.category,
          body: t.components?.find((c) => c.type === 'BODY')?.text ?? '',
        }));
    } catch (error) {
      this.logger.warn(
        `WhatsApp template list error: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /** Interactive reply buttons (max 3, titles max 20 chars). */
  async sendWhatsappButtons(
    toPhoneNumber: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    senderPhoneNumberId?: string,
  ): Promise<boolean> {
    const phoneNumberId =
      senderPhoneNumberId || this.config.get<string>('whatsapp.phoneNumberId');
    const accessToken = this.config.get<string>('whatsapp.accessToken');

    if (!phoneNumberId || !accessToken) {
      this.logger.warn(
        'WhatsApp configuration missing; skipping WhatsApp buttons',
      );
      return false;
    }

    try {
      let cleanNumber = toPhoneNumber.replace(/\D/g, '');
      if (cleanNumber.length === 10) {
        cleanNumber = '91' + cleanNumber;
      }
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanNumber,
            type: 'interactive',
            interactive: {
              type: 'button',
              body: { text: bodyText },
              action: {
                buttons: buttons.slice(0, 3).map((b) => ({
                  type: 'reply',
                  reply: { id: b.id, title: b.title.slice(0, 20) },
                })),
              },
            },
          }),
        },
      );

      if (!response.ok) {
        const errorData = (await response.json()) as Record<string, unknown>;
        this.logger.warn(
          `WhatsApp buttons send failed: ${JSON.stringify(errorData)}`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(
        `WhatsApp buttons send error: ${(error as Error).message}`,
      );
      return false;
    }
  }

  async sendWhatsappDocument(
    toPhoneNumber: string,
    documentUrl: string,
    filename: string,
    caption?: string,
    senderPhoneNumberId?: string,
  ): Promise<boolean> {
    const phoneNumberId =
      senderPhoneNumberId || this.config.get<string>('whatsapp.phoneNumberId');
    const accessToken = this.config.get<string>('whatsapp.accessToken');

    if (!phoneNumberId || !accessToken) {
      this.logger.warn(
        'WhatsApp configuration missing; skipping WhatsApp document',
      );
      return false;
    }

    try {
      let cleanNumber = toPhoneNumber.replace(/\D/g, '');
      if (cleanNumber.length === 10) {
        cleanNumber = '91' + cleanNumber;
      }
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanNumber,
            type: 'document',
            document: {
              link: documentUrl,
              filename,
              caption: caption || undefined,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorData = (await response.json()) as Record<string, unknown>;
        this.logger.error(
          `WhatsApp document send failed for ${toPhoneNumber}: ${JSON.stringify(errorData)}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `WhatsApp document send failed for ${toPhoneNumber}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  async sendWhatsappInteractiveList(
    toPhoneNumber: string,
    headerText: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    senderPhoneNumberId?: string,
  ): Promise<boolean> {
    const phoneNumberId =
      senderPhoneNumberId || this.config.get<string>('whatsapp.phoneNumberId');
    const accessToken = this.config.get<string>('whatsapp.accessToken');

    if (!phoneNumberId || !accessToken) {
      this.logger.warn(
        'WhatsApp configuration missing; skipping WhatsApp interactive list',
      );
      return false;
    }

    try {
      let cleanNumber = toPhoneNumber.replace(/\D/g, '');
      if (cleanNumber.length === 10) {
        cleanNumber = '91' + cleanNumber;
      }
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanNumber,
            type: 'interactive',
            interactive: {
              type: 'list',
              header: {
                type: 'text',
                text: headerText,
              },
              body: {
                text: bodyText,
              },
              action: {
                button: buttonText,
                sections,
              },
            },
          }),
        },
      );

      if (!response.ok) {
        const errorData = (await response.json()) as Record<string, unknown>;
        this.logger.warn(
          `WhatsApp interactive list send failed: ${JSON.stringify(errorData)}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn(
        `WhatsApp interactive list send error: ${(error as Error).message}`,
      );
      return false;
    }
  }

  health(): {
    ses: boolean;
    push: boolean;
    android_push: boolean;
    whatsapp: boolean;
  } {
    return {
      ses: Boolean(this.sourceEmail),
      push: this.vapidConfigured,
      android_push: this.firebase() !== null,
      whatsapp: Boolean(
        this.config.get<string>('whatsapp.phoneNumberId') &&
        this.config.get<string>('whatsapp.accessToken'),
      ),
    };
  }
}

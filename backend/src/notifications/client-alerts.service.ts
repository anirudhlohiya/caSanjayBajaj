import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from '../entities/device-token.entity';
import { User } from '../entities/user.entity';
import { WhatsappChatsService } from '../whatsapp-chats/whatsapp-chats.service';
import { NotificationsService } from './notifications.service';
import { ReportNotificationsService } from './report-notifications.service';
import { WhatsappTemplateKey } from './whatsapp-templates';

export interface ClientAlert {
  title: string;
  body: string;
  /** Route inside the client PWA, e.g. '/documents'. */
  deepLink: string;
  /** Extra HTML appended to the email after the body paragraph. */
  emailExtraHtml?: string;
  whatsapp?: {
    template: WhatsappTemplateKey;
    params: string[];
    headerDocument?: { link: string; filename: string };
  };
}

export interface ClientAlertResult {
  in_app: boolean;
  push: boolean;
  email: boolean;
  whatsapp: boolean;
}

/**
 * Delivers one alert to a client on every channel: in-app inbox, web push,
 * email and WhatsApp (approved template). Channels are independent — a
 * failure on one never blocks the others.
 */
@Injectable()
export class ClientAlertsService {
  private readonly logger = new Logger(ClientAlertsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly inbox: ReportNotificationsService,
    @InjectRepository(DeviceToken)
    private readonly deviceTokens: Repository<DeviceToken>,
    @Inject(forwardRef(() => WhatsappChatsService))
    private readonly chats: WhatsappChatsService,
  ) {}

  async send(user: User, alert: ClientAlert): Promise<ClientAlertResult> {
    const result: ClientAlertResult = {
      in_app: false,
      push: false,
      email: false,
      whatsapp: false,
    };

    result.in_app = await this.recordInApp(
      user.id,
      alert.title,
      alert.body,
      alert.deepLink,
    );

    result.push = await this.pushToUser(user.id, {
      title: alert.title,
      body: alert.body,
      url: alert.deepLink,
    });

    const appUrl = `${this.config.get<string>('clientAppUrl') ?? ''}${alert.deepLink}`;
    result.email = await this.notifications.sendEmail(
      { email: user.email, name: user.name },
      alert.title,
      `<p>Dear ${user.name},</p><p>${alert.body}</p>${alert.emailExtraHtml ?? ''}<p><a href="${appUrl}">Open in the app</a></p>`,
    );

    if (alert.whatsapp) {
      result.whatsapp = await this.sendWhatsappTemplate(
        user,
        alert.whatsapp.template,
        alert.whatsapp.params,
        alert.whatsapp.headerDocument,
      );
    }

    return result;
  }

  /**
   * Writes an entry to the client's in-app inbox (Notifications page).
   * Callers that deliver on other channels themselves use this so everything
   * the client was sent also shows up in the app. Never throws.
   */
  async recordInApp(
    userId: string,
    title: string,
    body: string,
    deepLink?: string,
  ): Promise<boolean> {
    try {
      await this.inbox.record(userId, title, body, deepLink);
      return true;
    } catch (err) {
      this.logger.warn(
        `In-app alert failed for ${userId}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Sends a platform template to the client's phone and records it in their
   * WhatsApp thread so staff see it on the admin desk.
   */
  async sendWhatsappTemplate(
    user: Pick<User, 'id' | 'phone'>,
    template: WhatsappTemplateKey,
    params: string[],
    headerDocument?: { link: string; filename: string },
  ): Promise<boolean> {
    if (!user.phone) return false;
    const def = this.notifications.templateDef(template);
    try {
      await this.chats.sendTemplate(user.phone, {
        template: def.name,
        language: def.language,
        params,
        headerDocument,
        sender: 'ai',
      });
      return true;
    } catch (err) {
      this.logger.warn(
        `WhatsApp ${def.name} failed for ${user.id}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /** Push to every device of a client (browser and Android app). */
  pushToUser(
    userId: string,
    payload: { title: string; body: string; url: string },
  ): Promise<boolean> {
    return this.notifications.pushToUser(userId, payload);
  }
}

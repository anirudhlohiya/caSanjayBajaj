import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfirmSubscriptionCommand, SNSClient } from '@aws-sdk/client-sns';
import { InjectRepository } from '@nestjs/typeorm';
import { createPublicKey, verify, type KeyObject } from 'node:crypto';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';

const MESSAGE_TYPES = [
  'Notification',
  'SubscriptionConfirmation',
  'UnsubscribeConfirmation',
] as const;

const STRING_TO_SIGN_FIELDS: Record<string, string[]> = {
  Notification: [
    'Message',
    'MessageId',
    'Subject',
    'SubscribeURL',
    'Timestamp',
    'Token',
    'TopicArn',
    'Type',
  ],
  SubscriptionConfirmation: [
    'MessageId',
    'SubscribeURL',
    'Timestamp',
    'Token',
    'TopicArn',
    'Type',
  ],
  UnsubscribeConfirmation: [
    'MessageId',
    'SubscribeURL',
    'Timestamp',
    'Token',
    'TopicArn',
    'Type',
  ],
};

const CERT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface SnsEnvelope {
  Type?: string;
  MessageId?: string;
  TopicArn?: string;
  Message?: string;
  Timestamp?: string;
  SignatureVersion?: string;
  Signature?: string;
  SigningCertURL?: string;
  SubscribeURL?: string;
  Token?: string;
  Subject?: string;
}

@Injectable()
export class SnsService {
  private readonly logger = new Logger(SnsService.name);
  private readonly sns: SNSClient;
  private readonly region: string;
  private readonly allowedTopicArn: string;
  private readonly certCache = new Map<
    string,
    { key: KeyObject; expires: number }
  >();

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
  ) {
    this.region = this.config.get<string>('aws.region') ?? 'ap-south-1';
    this.allowedTopicArn = this.config.get<string>('ses.snsTopicArn') ?? '';
    this.sns = new SNSClient({
      region: this.region,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('aws.accessKeyId'),
        secretAccessKey: this.config.getOrThrow<string>('aws.secretAccessKey'),
      },
    });
  }

  async handle(raw: unknown): Promise<void> {
    const envelope = raw as SnsEnvelope;
    const type = envelope.Type ?? '';
    if (!MESSAGE_TYPES.includes(type as (typeof MESSAGE_TYPES)[number])) {
      throw new Error('Unknown SNS message type');
    }
    if (typeof envelope.MessageId !== 'string') {
      throw new Error('Missing SNS MessageId');
    }
    if (
      this.allowedTopicArn &&
      envelope.TopicArn &&
      envelope.TopicArn !== this.allowedTopicArn
    ) {
      throw new Error('Unexpected SNS topic');
    }

    const verified = await this.verifySignature(envelope);
    if (!verified) {
      this.logger.warn(`SNS signature verification failed for ${type}`);
    }

    if (type === 'SubscriptionConfirmation') {
      if (verified) {
        try {
          await this.confirmSubscription(envelope);
        } catch (error) {
          this.logger.error(
            `Failed to confirm subscription: ${(error as Error).message}`,
          );
        }
      }
      return;
    }
    if (type === 'UnsubscribeConfirmation') {
      return;
    }

    if (
      type === 'Notification' &&
      verified &&
      typeof envelope.Message === 'string'
    ) {
      await this.processSesEvent(envelope.Message);
    }
  }

  private async verifySignature(envelope: SnsEnvelope): Promise<boolean> {
    const signature = envelope.Signature;
    const certUrl = envelope.SigningCertURL;
    const version = envelope.SignatureVersion ?? '1';
    if (typeof signature !== 'string' || typeof certUrl !== 'string') {
      return false;
    }
    const algorithm = version === '2' ? 'RSA-SHA256' : 'RSA-SHA1';
    let key: KeyObject;
    try {
      key = await this.getSigningCert(certUrl);
    } catch {
      return false;
    }
    const stringToSign = this.buildStringToSign(envelope);
    try {
      return verify(
        algorithm,
        Buffer.from(stringToSign, 'utf8'),
        key,
        Buffer.from(signature, 'base64'),
      );
    } catch {
      return false;
    }
  }

  private buildStringToSign(envelope: SnsEnvelope): string {
    const fields = STRING_TO_SIGN_FIELDS[envelope.Type ?? ''];
    if (!fields) throw new Error('Unknown SNS message type');
    let out = '';
    for (const field of fields) {
      const value = envelope[field as keyof SnsEnvelope];
      if (typeof value === 'string') {
        out += `${field}\n${value}\n`;
      }
    }
    return out;
  }

  private async getSigningCert(urlStr: string): Promise<KeyObject> {
    const url = new URL(urlStr);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== `sns.${this.region}.amazonaws.com`
    ) {
      throw new Error('Invalid SNS signing cert URL');
    }
    if (!url.pathname.startsWith('/SimpleNotificationService-')) {
      throw new Error('Invalid SNS signing cert path');
    }
    const cached = this.certCache.get(urlStr);
    if (cached && cached.expires > Date.now()) {
      return cached.key;
    }
    const res = await fetch(urlStr);
    if (!res.ok) {
      throw new Error('SNS signing cert fetch failed');
    }
    const key = createPublicKey(await res.text());
    this.certCache.set(urlStr, {
      key,
      expires: Date.now() + CERT_CACHE_TTL_MS,
    });
    return key;
  }

  private async confirmSubscription(envelope: SnsEnvelope): Promise<void> {
    const token = envelope.Token;
    const topicArn = envelope.TopicArn;
    if (typeof token !== 'string' || typeof topicArn !== 'string') {
      throw new Error('Incomplete subscription confirmation');
    }
    await this.sns.send(
      new ConfirmSubscriptionCommand({ Token: token, TopicArn: topicArn }),
    );
    this.logger.log(`Confirmed SNS subscription for ${topicArn}`);
  }

  private async processSesEvent(message: string): Promise<void> {
    let session: unknown;
    try {
      session = JSON.parse(message);
    } catch {
      this.logger.warn('Received non-JSON SNS notification message');
      return;
    }
    if (!this.isRecord(session)) return;

    const eventType = session['eventType'];
    if (typeof eventType !== 'string') return;

    if (eventType === 'Bounce') {
      const bounce = this.field(session, 'bounce');
      const bounceType =
        typeof bounce?.['bounceType'] === 'string' ? bounce['bounceType'] : '';
      const recipients = this.arrayField(bounce, 'bouncedRecipients');
      const emails = this.recipientEmails(recipients, session);
      if (bounceType === 'Permanent') {
        await this.suppress(emails, 'bounce', bounceType);
      } else {
        this.logger.log(
          `Transient/undetermined bounce (${bounceType}), not suppressing`,
        );
      }
    } else if (eventType === 'Complaint') {
      const complaint = this.field(session, 'complaint');
      const recipients = this.arrayField(complaint, 'complainedRecipients');
      const emails = this.recipientEmails(recipients, session);
      const feedbackId =
        typeof complaint?.['feedbackId'] === 'string'
          ? complaint['feedbackId']
          : '';
      await this.suppress(emails, 'complaint', feedbackId);
    } else {
      this.logger.log(`Ignoring SES event type ${eventType}`);
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private field(
    obj: Record<string, unknown> | null | undefined,
    key: string,
  ): Record<string, unknown> | null {
    if (!obj) return null;
    const value = obj[key];
    return this.isRecord(value) ? value : null;
  }

  private arrayField(
    obj: Record<string, unknown> | null | undefined,
    key: string,
  ): unknown[] {
    const value = obj?.[key];
    return Array.isArray(value) ? value : [];
  }

  private recipientEmails(
    recipients: unknown[],
    session: Record<string, unknown>,
  ): string[] {
    const direct: string[] = [];
    for (const entry of recipients) {
      if (this.isRecord(entry) && typeof entry['emailAddress'] === 'string') {
        direct.push(entry['emailAddress']);
      }
    }
    if (direct.length > 0) return direct;
    const mail = this.field(session, 'mail');
    const destination = mail?.['destination'];
    if (Array.isArray(destination)) {
      return destination.filter((e): e is string => typeof e === 'string');
    }
    return [];
  }

  private async suppress(
    emails: string[],
    event: string,
    reason: string,
  ): Promise<void> {
    for (const raw of emails) {
      const email = String(raw).toLowerCase().trim();
      if (!email) continue;
      const user = await this.users.findOne({ where: { email } });
      if (!user) {
        this.logger.warn(`No registered user for ${event} on ${email}`);
        continue;
      }
      if (user.email_suppressed_at) continue;
      await this.users.update(
        { id: user.id },
        { email_suppressed_at: new Date() },
      );
      await this.auditLogs.save(
        this.auditLogs.create({
          admin_id: null,
          action: 'email.suppressed',
          target_user_id: user.id,
          detail: { event, reason, email },
        }),
      );
      this.logger.warn(`Suppressed ${email} after ${event}: ${reason}`);
    }
  }
}

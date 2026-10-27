import { createHmac } from 'node:crypto';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';

type Check = (this: unknown, req: RawBodyRequest<Request>) => boolean;
const check = (
  WhatsappWebhookController.prototype as unknown as {
    hasValidSignature: Check;
  }
).hasValidSignature;

/** Just the fields the signature check reads. */
const controller = (secret: string) => ({
  configService: { get: () => secret },
  logger: { warn: jest.fn() },
  warnedNoSecret: false,
});

const body = Buffer.from('{"object":"whatsapp_business_account","entry":[]}');
const sign = (secret: string, raw: Buffer) =>
  `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
const request = (signature?: string, raw: Buffer = body) =>
  ({
    headers: signature ? { 'x-hub-signature-256': signature } : {},
    rawBody: raw,
  }) as unknown as RawBodyRequest<Request>;

describe('WhatsApp webhook signature', () => {
  it('accepts a call signed by Meta with the app secret', () => {
    expect(
      check.call(controller('s3cret'), request(sign('s3cret', body))),
    ).toBe(true);
  });

  it('rejects a forged call (wrong secret, edited body, or no signature)', () => {
    const c = controller('s3cret');
    expect(check.call(c, request(sign('guess', body)))).toBe(false);
    expect(
      check.call(c, request(sign('s3cret', body), Buffer.from('{"forged":1}'))),
    ).toBe(false);
    expect(check.call(c, request())).toBe(false);
  });

  it('lets calls through (with one warning) until the secret is configured', () => {
    const c = controller('');
    expect(check.call(c, request())).toBe(true);
    expect(check.call(c, request())).toBe(true);
    expect(c.logger.warn).toHaveBeenCalledTimes(1);
  });
});

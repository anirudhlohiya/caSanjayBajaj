import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SnsService } from './sns.service';

@Controller('sns')
export class SnsController {
  constructor(private readonly snsService: SnsService) {}

  @Post('notifications')
  @HttpCode(200)
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: unknown,
  ): Promise<{ status: 'ok' }> {
    const payload = this.parsePayload(req.rawBody, body);
    await this.snsService.handle(payload);
    return { status: 'ok' };
  }

  private parsePayload(
    raw: Buffer | undefined | null,
    body: unknown,
  ): Record<string, unknown> {
    if (raw && raw.length > 0) {
      try {
        return JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
      } catch {
        throw new UnauthorizedException('Malformed SNS payload');
      }
    }
    if (typeof body === 'string') {
      try {
        return JSON.parse(body) as Record<string, unknown>;
      } catch {
        throw new UnauthorizedException('Malformed SNS payload');
      }
    }
    if (typeof body === 'object' && body !== null) {
      return body as Record<string, unknown>;
    }
    throw new UnauthorizedException('Malformed SNS payload');
  }
}
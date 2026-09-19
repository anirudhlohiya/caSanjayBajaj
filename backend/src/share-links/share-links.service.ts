import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { ReportShareLink } from '../entities/report-share-link.entity';

export interface ShareLinkIssue {
  token: string;
  expires_at: Date;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class ShareLinksService {
  private readonly ttlDays: number;

  constructor(
    @InjectRepository(ReportShareLink)
    private readonly links: Repository<ReportShareLink>,
    config: ConfigService,
  ) {
    const configured = config.get<number>('shareLinks.ttlDays');
    this.ttlDays =
      configured && Number.isFinite(configured) && configured > 0
        ? configured
        : 30;
  }

  async createLink(reportId: string): Promise<ShareLinkIssue> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlDays * 24 * 60 * 60 * 1000);
    await this.links.save(
      this.links.create({
        report_id: reportId,
        token_hash: hashToken(token),
        expires_at: expiresAt,
      }),
    );
    return { token, expires_at: expiresAt };
  }

  /**
   * Resolves a raw token to its share link (report + period preloaded), or
   * null when the token is unknown. Expiry is checked by the caller so a
   * "link has expired" response can be issued distinctly from "not found".
   */
  async findByToken(token: string): Promise<ReportShareLink | null> {
    return this.links.findOne({
      where: { token_hash: hashToken(token) },
      relations: { report: { filing_period: true } },
    });
  }
}

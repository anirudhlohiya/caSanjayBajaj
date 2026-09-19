import { Controller, Get, Param, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { StorageService } from '../storage/storage.service';
import { ShareLinksService } from './share-links.service';

@ApiTags('share-links')
@Controller()
export class ShareLinksController {
  constructor(
    private readonly shareLinks: ShareLinksService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Public, credential-free download for the emailed 30-day share links
   * (docs/13 §3.8). The token doubles as the credential, so the route is
   * throttled to 10 requests/minute/IP and redirects (never proxies bytes).
   */
  @Get('public/report/download/:token')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Download a report via emailed token (public, 302 redirect)',
  })
  async download(@Param('token') token: string, @Res() res: Response) {
    const link = await this.shareLinks.findByToken(token);
    if (!link) {
      this.friendly(res, 'We could not find this download link.');
      return;
    }
    if (link.expires_at.getTime() < Date.now()) {
      this.friendly(
        res,
        'This download link has expired. Please ask your CA for a fresh copy of the report.',
      );
      return;
    }
    const url = await this.storage.createAttachmentDownloadUrl(
      link.report.s3_key,
      link.report.original_filename,
    );
    res.redirect(302, url);
  }

  private friendly(res: Response, message: string) {
    res
      .status(404)
      .send(
        `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Download link</title><style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f7f7f7;display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center}div{max-width:480px;padding:32px;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08);text-align:center}p{color:#444;line-height:1.6}</style></head>` +
          `<body><div><h2 style="color:#1a1a1a">S N Bajaj &amp; Co</h2><p>${message}</p></div></body></html>`,
      );
  }
}

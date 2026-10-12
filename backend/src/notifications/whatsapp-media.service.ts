import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class WhatsappMediaService {
  private readonly logger = new Logger(WhatsappMediaService.name);
  private readonly r2Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    const accountId = this.config.get<string>('r2.accountId');
    const accessKeyId = this.config.get<string>('r2.accessKeyId');
    const secretAccessKey = this.config.get<string>('r2.secretAccessKey');
    this.bucketName =
      this.config.get<string>('r2.bucketName') || 'snbajaj-whatsapp-media';
    this.publicBaseUrl = this.config.get<string>('r2.publicUrl') || '';

    if (accountId && accessKeyId && secretAccessKey) {
      this.r2Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.logger.log('Cloudflare R2 storage initialized for WhatsApp media');
    } else {
      this.logger.warn(
        'Cloudflare R2 credentials not fully set; media storage will fallback or skip upload',
      );
    }
  }

  /**
   * Fetches inbound media from Meta Graph API using the temporary mediaId and stores
   * it in Cloudflare R2 object storage to preserve access permanently.
   */
  async processAndStoreMedia(
    mediaId: string,
    mimeType?: string,
    filenameHint?: string,
  ): Promise<string | null> {
    const accessToken = this.config.get<string>('whatsapp.accessToken');
    if (!accessToken) {
      this.logger.warn('WhatsApp accessToken missing; cannot download media');
      return null;
    }

    try {
      // 1. Get media download URL from Meta
      const metaRes = await fetch(
        `https://graph.facebook.com/v21.0/${mediaId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!metaRes.ok) {
        this.logger.error(
          `Failed to fetch Meta media metadata for ID ${mediaId}: HTTP ${metaRes.status}`,
        );
        return null;
      }

      const metaData = (await metaRes.json()) as { url?: string; mime_type?: string };
      if (!metaData.url) {
        return null;
      }

      // 2. Download the actual binary file
      const downloadRes = await fetch(metaData.url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!downloadRes.ok) {
        this.logger.error(
          `Failed to download media binary from Meta for ID ${mediaId}`,
        );
        return null;
      }

      const buffer = Buffer.from(await downloadRes.arrayBuffer());
      const effectiveMime = mimeType || metaData.mime_type || 'application/octet-stream';
      const extension = this.getExtension(effectiveMime, filenameHint);
      const key = `whatsapp/${Date.now()}_${mediaId.slice(-8)}${extension}`;

      // 3. Upload to Cloudflare R2 if configured
      if (this.r2Client) {
        await this.r2Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: effectiveMime,
          }),
        );

        if (this.publicBaseUrl) {
          const cleanBase = this.publicBaseUrl.replace(/\/$/, '');
          return `${cleanBase}/${key}`;
        }
        return `https://${this.bucketName}.r2.cloudflarestorage.com/${key}`;
      }

      // Fallback: return data URI or temporary url if R2 is not enabled yet
      return metaData.url;
    } catch (err) {
      this.logger.error(
        `Error downloading/storing WhatsApp media: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private getExtension(mime: string, hint?: string): string {
    if (hint && hint.includes('.')) {
      const ext = hint.slice(hint.lastIndexOf('.'));
      if (ext.length <= 5) return ext;
    }
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'audio/ogg': '.ogg',
      'audio/mpeg': '.mp3',
      'audio/mp4': '.m4a',
    };
    return map[mime] || '.bin';
  }
}

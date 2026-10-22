import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { StorageService } from '../storage/storage.service';

export interface StoredWhatsappMedia {
  s3Key: string;
  publicUrl?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class WhatsappMediaService {
  private readonly logger = new Logger(WhatsappMediaService.name);
  private readonly r2Client: S3Client | null = null;
  private readonly r2BucketName: string;
  private readonly r2PublicBaseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {
    const accountId = this.config.get<string>('r2.accountId');
    const accessKeyId = this.config.get<string>('r2.accessKeyId');
    const secretAccessKey = this.config.get<string>('r2.secretAccessKey');
    this.r2BucketName =
      this.config.get<string>('r2.bucketName') || 'snbajaj-whatsapp-media';
    this.r2PublicBaseUrl = this.config.get<string>('r2.publicUrl') || '';

    if (accountId && accessKeyId && secretAccessKey) {
      this.r2Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.logger.log(
        'Cloudflare R2 storage initialized as secondary media backup',
      );
    }
  }

  /**
   * Fetches inbound media from Meta Graph API using the temporary mediaId and stores
   * it directly to AWS S3 at:
   * whatsapp-uploads/{clientId-or-phone}/{YYYY-MM}/{filename}
   */
  async processAndStoreMedia(
    mediaId: string,
    mimeType?: string,
    filenameHint?: string,
    clientFolder: string = 'general',
  ): Promise<StoredWhatsappMedia | null> {
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

      const metaData = (await metaRes.json()) as {
        url?: string;
        mime_type?: string;
      };
      if (!metaData.url) {
        return null;
      }

      // 2. Download the binary payload from Meta
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
      const effectiveMime =
        mimeType || metaData.mime_type || 'application/octet-stream';
      const extension = this.getExtension(effectiveMime, filenameHint);

      const ym = new Date().toISOString().slice(0, 7); // e.g. 2026-10
      const safeFolder = clientFolder.replace(/[^a-zA-Z0-9_-]/g, '_');
      const baseFilename = (
        filenameHint || `doc_${Date.now()}${extension}`
      ).replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const s3Key = `whatsapp-uploads/${safeFolder}/${ym}/${uniquePrefix}_${baseFilename}`;

      // 3. Upload to primary S3 object storage
      await this.storage.uploadBuffer(s3Key, buffer, effectiveMime);
      this.logger.log(`Successfully stored WhatsApp media to S3: ${s3Key}`);

      let publicUrl: string | undefined = undefined;

      // 4. Also store in R2 if configured
      if (this.r2Client) {
        try {
          await this.r2Client.send(
            new PutObjectCommand({
              Bucket: this.r2BucketName,
              Key: s3Key,
              Body: buffer,
              ContentType: effectiveMime,
            }),
          );
          if (this.r2PublicBaseUrl) {
            const cleanBase = this.r2PublicBaseUrl.replace(/\/$/, '');
            publicUrl = `${cleanBase}/${s3Key}`;
          }
        } catch (r2Err) {
          this.logger.warn(`R2 upload warning: ${(r2Err as Error).message}`);
        }
      }

      return {
        s3Key,
        publicUrl,
        filename: baseFilename,
        mimeType: effectiveMime,
        sizeBytes: buffer.length,
      };
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
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        '.xlsx',
      'application/vnd.ms-excel': '.xls',
      'text/csv': '.csv',
      'audio/ogg': '.ogg',
      'audio/mpeg': '.mp3',
      'audio/mp4': '.m4a',
    };
    return map[mime] || '.bin';
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadTarget {
  uploadUrl: string;
  s3Key: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly docsBucket: string;

  constructor(private readonly config: ConfigService) {
    this.docsBucket = this.config.getOrThrow<string>('aws.docsBucket');
    this.client = new S3Client({
      region: this.config.get('aws.region'),
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('aws.accessKeyId'),
        secretAccessKey: this.config.getOrThrow<string>('aws.secretAccessKey'),
      },
    });
  }

  private buildKey(
    prefix: 'docs' | 'reports',
    userId: string,
    periodCode: string,
    filename: string,
  ): string {
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'bin';
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return `${prefix}/${userId}/${periodCode}/${unique}_${safe}.${ext}`;
  }

  async createUploadUrl(
    prefix: 'docs' | 'reports',
    userId: string,
    periodCode: string,
    filename: string,
    contentType: string,
  ): Promise<UploadTarget> {
    const s3Key = this.buildKey(prefix, userId, periodCode, filename);
    const command = new PutObjectCommand({
      Bucket: this.docsBucket,
      Key: s3Key,
      ContentType: contentType,
      Metadata: { original_name: filename },
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: 300,
    });
    return { uploadUrl, s3Key };
  }

  async createDownloadUrl(s3Key: string, expiresIn = 300): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.docsBucket,
      Key: s3Key,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async createTicketUploadUrl(
    s3Key: string,
    contentType: string,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.docsBucket,
      Key: s3Key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: 300 });
  }

  async health(): Promise<boolean> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.docsBucket,
        Key: `health/${Date.now()}.txt`,
        Body: 'ok',
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      this.logger.error(`S3 health check failed: ${(error as Error).message}`);
      return false;
    }
  }
}

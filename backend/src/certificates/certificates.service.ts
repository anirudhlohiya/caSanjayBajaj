import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { ClientCertificate, User } from '../entities';
import { StorageService } from '../storage/storage.service';
import { CreateCertificateUploadUrlDto } from './dto/certificate.dto';

@Injectable()
export class CertificatesService {
  constructor(
    @InjectRepository(ClientCertificate)
    private readonly certificates: Repository<ClientCertificate>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /** All confirmed certificates for a user (docs/13 §6.5 admin list). */
  async listForUser(userId: string): Promise<ClientCertificate[]> {
    return this.certificates.find({
      where: { user_id: userId, uploaded_at: Not(IsNull()) },
      order: { uploaded_at: 'DESC' },
    });
  }

  /** Client-facing list (docs/13 §6.5 GET /me/certificates). */
  async listMine(auth: AuthUser): Promise<ClientCertificate[]> {
    return this.listForUser(auth.sub);
  }

  /**
   * Admin requests a presigned PUT URL for a new certificate. The row is
   * created with uploaded_at = null; `confirm` finalizes it (docs/13 §3.6).
   */
  async requestUploadUrl(userId: string, dto: CreateCertificateUploadUrlDto) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');

    const { uploadUrl, s3Key } = await this.storage.createCertificateUploadUrl(
      userId,
      dto.filename,
      dto.contentType,
    );

    const cert = await this.certificates.save(
      this.certificates.create({
        user_id: userId,
        cert_type: dto.cert_type,
        s3_key: s3Key,
        original_filename: dto.filename,
        uploaded_at: null,
      }),
    );

    return {
      certificate_id: cert.id,
      upload_url: uploadUrl,
      expires_in: 300,
    };
  }

  /**
   * Admin confirms the direct S3 upload → certificate goes live. Replaces any
   * earlier certificate of the same type (docs/13 §5.4 #2 "upload/replace").
   */
  async confirm(auth: AuthUser, certId: string): Promise<ClientCertificate> {
    const cert = await this.certificates.findOne({ where: { id: certId } });
    if (!cert) throw new NotFoundException('Certificate not found');

    cert.uploaded_at = new Date();
    const saved = await this.certificates.save(cert);

    const prior = await this.certificates.find({
      where: {
        user_id: cert.user_id,
        cert_type: cert.cert_type,
        id: Not(cert.id),
      },
    });
    if (prior.length > 0) {
      await this.certificates.remove(prior);
    }

    await this.audit.log(
      auth.sub,
      'certificate.uploaded',
      {
        client_certificate_id: cert.id,
        cert_type: cert.cert_type,
        filename: cert.original_filename,
      },
      { user_id: cert.user_id },
    );
    return saved;
  }

  /** Lifetime download URL for an owner (docs/13 §6.5 GET /me/certificates/:id/download-url). */
  async downloadUrl(
    auth: AuthUser,
    certId: string,
  ): Promise<{ download_url: string }> {
    const cert = await this.certificates.findOne({ where: { id: certId } });
    if (!cert) throw new NotFoundException('Certificate not found');

    if (auth.type === 'user' && auth.sub !== cert.user_id) {
      throw new ForbiddenException('Cannot access another user certificate');
    }
    if (cert.uploaded_at === null) {
      throw new NotFoundException('Certificate not yet confirmed');
    }

    const url = await this.storage.createDownloadUrl(cert.s3_key);
    return { download_url: url };
  }
}

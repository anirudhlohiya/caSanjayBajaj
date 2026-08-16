import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { paginate, PaginatedResult } from '../common/dto/pagination';
import { DocumentStatus } from '../common/enums';
import { Document } from '../entities/document.entity';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { UsersService } from '../users/users.service';
import { StorageService } from '../storage/storage.service';
import {
  ConfirmUploadDto,
  CreateUploadUrlDto,
  DocumentStatusQueryDto,
} from './dto/document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documents: Repository<Document>,
    @InjectRepository(GstFilingPeriod)
    private readonly periods: Repository<GstFilingPeriod>,
    private readonly storage: StorageService,
    private readonly usersService: UsersService,
  ) {}

  async requestUploadUrl(auth: AuthUser, dto: CreateUploadUrlDto) {
    // Admin may specify a target user; a client only ever targets themselves
    const targetUserId = auth.type === 'admin' ? dto.user_id! : auth.sub;

    const period = await this.periods.findOneBy({ id: dto.filing_period_id });
    if (!period) throw new NotFoundException('Filing period not found');
    if (auth.type === 'user' && !period.is_open) {
      throw new ForbiddenException('This filing period is closed for uploads');
    }

    const { uploadUrl, s3Key } = await this.storage.createUploadUrl(
      'docs',
      targetUserId,
      period.period_code,
      dto.filename,
      dto.contentType,
    );

    const doc = await this.documents.save(
      this.documents.create({
        user_id: targetUserId,
        filing_period_id: period.id,
        s3_key: s3Key,
        original_filename: dto.filename,
        file_type: dto.file_type,
        file_size_bytes: String(dto.file_size_bytes),
        status: DocumentStatus.PENDING,
      }),
    );

    return {
      document_id: doc.id,
      upload_url: uploadUrl,
      expires_in: 300,
    };
  }

  async confirmUpload(
    auth: AuthUser,
    documentId: string,
    dto: ConfirmUploadDto,
  ) {
    const doc = await this.documents.findOneBy({ id: documentId });
    if (!doc) throw new NotFoundException('Document not found');
    this.assertCanTouch(auth, doc);

    doc.status = DocumentStatus.RECEIVED;
    doc.file_size_bytes = String(dto.file_size_bytes);
    return this.documents.save(doc);
  }

  async listForUser(
    auth: AuthUser,
    targetUserId: string,
    query: DocumentStatusQueryDto,
  ): Promise<PaginatedResult<Document>> {
    if (auth.type === 'user' && auth.sub !== targetUserId) {
      throw new ForbiddenException('Cannot access another user documents');
    }
    if (auth.type === 'admin' && !auth.role) {
      // staff must have view_documents; super_admin role is set
      throw new ForbiddenException('Permission required');
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const qb = this.documents
      .createQueryBuilder('doc')
      .leftJoinAndSelect('doc.filing_period', 'period')
      .where('doc.user_id = :uid', { uid: targetUserId })
      .orderBy('doc.uploaded_at', 'DESC');

    if (query.filing_period_id)
      qb.andWhere('doc.filing_period_id = :pid', {
        pid: query.filing_period_id,
      });
    if (query.status)
      qb.andWhere('doc.status = :status', { status: query.status });

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return paginate(items, total, page, pageSize);
  }

  async adminList(
    query: DocumentStatusQueryDto,
  ): Promise<PaginatedResult<Document>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const qb = this.documents
      .createQueryBuilder('doc')
      .leftJoinAndSelect('doc.user', 'user')
      .leftJoinAndSelect('doc.filing_period', 'period')
      .orderBy('doc.uploaded_at', 'DESC');

    if (query.filing_period_id)
      qb.andWhere('doc.filing_period_id = :pid', {
        pid: query.filing_period_id,
      });
    if (query.status)
      qb.andWhere('doc.status = :status', { status: query.status });

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return paginate(items, total, page, pageSize);
  }

  async downloadUrl(
    auth: AuthUser,
    documentId: string,
  ): Promise<{ download_url: string }> {
    const doc = await this.documents.findOneBy({ id: documentId });
    if (!doc) throw new NotFoundException('Document not found');
    this.assertCanTouch(auth, doc);

    const url = await this.storage.createDownloadUrl(doc.s3_key);
    return { download_url: url };
  }

  async markProcessed(auth: AuthUser, documentId: string) {
    if (auth.type !== 'admin') throw new ForbiddenException('Admin only');
    const doc = await this.documents.findOneBy({ id: documentId });
    if (!doc) throw new NotFoundException('Document not found');

    doc.status = DocumentStatus.PROCESSED;
    doc.processed_at = new Date();
    return this.documents.save(doc);
  }

  private assertCanTouch(auth: AuthUser, doc: Document) {
    if (auth.type === 'admin') return; // admin guard enforces permission separately
    if (auth.sub !== doc.user_id) {
      throw new ForbiddenException('Cannot access another user document');
    }
  }
}

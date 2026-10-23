import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComplianceTasksService } from '../compliance-tasks/compliance-tasks.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { paginate, PaginatedResult } from '../common/dto/pagination';
import { DocumentCategory, DocumentStatus, UserType } from '../common/enums';
import { Document } from '../entities/document.entity';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { UsersService } from '../users/users.service';
import { FamilyMembersService } from '../family-members/family-members.service';
import { StorageService } from '../storage/storage.service';
import { currentAssessmentYear } from '../compliance-tasks/task-upload.util';
import {
  AssignDocumentDto,
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
    private readonly tasksService: ComplianceTasksService,
    private readonly familyMembers: FamilyMembersService,
  ) {}

  private getUnlockedCategories(userType: UserType): DocumentCategory[] {
    switch (userType) {
      case UserType.GST:
        return [DocumentCategory.GENERAL, DocumentCategory.GST];
      case UserType.ITR:
        return [DocumentCategory.GENERAL, DocumentCategory.ITR];
      case UserType.BOTH:
        return [
          DocumentCategory.GENERAL,
          DocumentCategory.GST,
          DocumentCategory.ITR,
        ];
      case UserType.GENERAL:
      default:
        return [DocumentCategory.GENERAL];
    }
  }

  async requestUploadUrl(auth: AuthUser, dto: CreateUploadUrlDto) {
    // Admin may specify a target user; a client only ever targets themselves
    let targetUserId: string;
    if (auth.type === 'admin') {
      if (!dto.user_id) {
        throw new BadRequestException(
          'user_id is required when an admin requests an upload URL',
        );
      }
      targetUserId = dto.user_id;
    } else {
      targetUserId = auth.sub;
    }

    const targetUser = await this.usersService.findOne(targetUserId);
    const category = dto.category ?? DocumentCategory.GST;

    if (auth.type === 'user') {
      const unlocked = this.getUnlockedCategories(targetUser.user_type);
      if (!unlocked.includes(category)) {
        throw new ForbiddenException(
          `You do not have access to ${category} documents`,
        );
      }
    }

    let uploadUrl: string;
    let s3Key: string;
    let filingPeriodId: string | null = null;
    let assessmentYear: string | null = null;
    let familyMemberId: string | null = null;

    if (category === DocumentCategory.GST) {
      if (!dto.filing_period_id) {
        throw new BadRequestException(
          'filing_period_id is required for GST documents',
        );
      }
      const period = await this.periods.findOneBy({ id: dto.filing_period_id });
      if (!period) throw new NotFoundException('Filing period not found');
      if (auth.type === 'user' && !period.is_open) {
        throw new ForbiddenException(
          'This filing period is closed for uploads',
        );
      }
      filingPeriodId = period.id;
      const res = await this.storage.createUploadUrl(
        'docs',
        targetUserId,
        period.period_code,
        dto.filename,
        dto.contentType,
      );
      uploadUrl = res.uploadUrl;
      s3Key = res.s3Key;
    } else if (category === DocumentCategory.ITR) {
      if (!dto.assessment_year?.trim()) {
        throw new BadRequestException(
          'assessment_year is required for ITR documents',
        );
      }
      assessmentYear = dto.assessment_year.trim();
      if (dto.family_member_id) {
        await this.familyMembers.get(targetUserId, dto.family_member_id);
        familyMemberId = dto.family_member_id;
      }
      const safeAY = assessmentYear.replace(/[^a-zA-Z0-9_-]/g, '_');
      const res = await this.storage.createUploadUrl(
        'docs',
        targetUserId,
        `ITR-${safeAY}`,
        dto.filename,
        dto.contentType,
      );
      uploadUrl = res.uploadUrl;
      s3Key = res.s3Key;
    } else {
      // General
      const res = await this.storage.createUploadUrl(
        'docs',
        targetUserId,
        'general',
        dto.filename,
        dto.contentType,
      );
      uploadUrl = res.uploadUrl;
      s3Key = res.s3Key;
    }

    const doc = await this.documents.save(
      this.documents.create({
        user_id: targetUserId,
        category,
        filing_period_id: filingPeriodId,
        assessment_year: assessmentYear,
        family_member_id: familyMemberId,
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
    const saved = await this.documents.save(doc);

    // If GST document with filing period, advance the first pending filing task
    if (
      doc.status === DocumentStatus.RECEIVED &&
      doc.category === DocumentCategory.GST &&
      doc.filing_period_id
    ) {
      await this.tasksService.markUploadedForDocumentConfirm(
        doc.user_id,
        doc.filing_period_id,
      );
    }

    return saved;
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

    const targetUser = await this.usersService.findOne(targetUserId);
    const unlocked = this.getUnlockedCategories(targetUser.user_type);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const qb = this.documents
      .createQueryBuilder('doc')
      .leftJoinAndSelect('doc.filing_period', 'period')
      .where('doc.user_id = :uid', { uid: targetUserId })
      .orderBy('doc.uploaded_at', 'DESC');

    if (query.category) {
      if (auth.type === 'user' && !unlocked.includes(query.category)) {
        throw new ForbiddenException(
          'You do not have access to this document category',
        );
      }
      qb.andWhere('doc.category = :category', { category: query.category });
    } else if (auth.type === 'user') {
      qb.andWhere('doc.category IN (:...unlocked)', { unlocked });
    }

    if (query.filing_period_id)
      qb.andWhere('doc.filing_period_id = :pid', {
        pid: query.filing_period_id,
      });
    if (query.assessment_year)
      qb.andWhere('doc.assessment_year = :ay', {
        ay: query.assessment_year,
      });
    if (query.family_member_id === 'self') {
      qb.andWhere('doc.family_member_id IS NULL');
    } else if (query.family_member_id) {
      qb.andWhere('doc.family_member_id = :fm', {
        fm: query.family_member_id,
      });
    }
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

    if (query.category) {
      qb.andWhere('doc.category = :category', { category: query.category });
    }
    if (query.filing_period_id)
      qb.andWhere('doc.filing_period_id = :pid', {
        pid: query.filing_period_id,
      });
    if (query.assessment_year)
      qb.andWhere('doc.assessment_year = :ay', {
        ay: query.assessment_year,
      });
    if (query.family_member_id === 'self') {
      qb.andWhere('doc.family_member_id IS NULL');
    } else if (query.family_member_id) {
      qb.andWhere('doc.family_member_id = :fm', {
        fm: query.family_member_id,
      });
    }
    if (query.status)
      qb.andWhere('doc.status = :status', { status: query.status });
    if (query.unassigned) {
      qb.andWhere("doc.s3_key LIKE 'whatsapp-uploads/%'")
        .andWhere('doc.category = :general', {
          general: DocumentCategory.GENERAL,
        })
        .andWhere('doc.filing_period_id IS NULL');
    }

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

  /**
   * Admin files a document (typically an unassigned WhatsApp upload) under a
   * GST month or ITR year. A GST month advances that month's filing task,
   * the same as a client app upload.
   */
  async assign(documentId: string, dto: AssignDocumentDto) {
    const doc = await this.documents.findOneBy({ id: documentId });
    if (!doc) throw new NotFoundException('Document not found');

    doc.category = dto.category;
    doc.filing_period_id = null;
    doc.assessment_year = null;
    if (dto.category === DocumentCategory.GST) {
      const period = await this.periods.findOneBy({
        id: dto.filing_period_id,
      });
      if (!period) throw new BadRequestException('Filing period not found');
      doc.filing_period_id = period.id;
    } else if (dto.category === DocumentCategory.ITR) {
      doc.assessment_year = dto.assessment_year ?? currentAssessmentYear();
    }
    const saved = await this.documents.save(doc);

    if (saved.category === DocumentCategory.GST && saved.filing_period_id) {
      await this.tasksService.markUploadedForDocumentConfirm(
        saved.user_id,
        saved.filing_period_id,
      );
    }
    return saved;
  }

  private assertCanTouch(auth: AuthUser, doc: Document) {
    if (auth.type === 'admin') return; // admin guard enforces permission separately
    if (auth.sub !== doc.user_id) {
      throw new ForbiddenException('Cannot access another user document');
    }
  }
}

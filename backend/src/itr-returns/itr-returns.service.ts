import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { UserType } from '../common/enums';
import { ItrReturn, User } from '../entities';
import { FamilyMembersService } from '../family-members/family-members.service';
import { StorageService } from '../storage/storage.service';
import {
  ConfirmItrReturnDto,
  CreateItrReturnUploadUrlDto,
} from './dto/itr-return.dto';

@Injectable()
export class ItrReturnsService {
  constructor(
    @InjectRepository(ItrReturn)
    private readonly itrReturns: Repository<ItrReturn>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly familyMembers: FamilyMembersService,
  ) {}

  /**
   * Admin requests a presigned S3 PUT URL for uploading an ITR return PDF.
   */
  async requestUploadUrl(
    clientId: string,
    dto: CreateItrReturnUploadUrlDto,
  ): Promise<{ upload_url: string; s3_key: string; expires_in: number }> {
    const client = await this.users.findOneBy({ id: clientId });
    if (!client) throw new NotFoundException('Client not found');

    const { uploadUrl, s3Key } = await this.storage.createItrReturnUploadUrl(
      clientId,
      dto.assessment_year,
      dto.filename,
      dto.contentType,
    );

    return {
      upload_url: uploadUrl,
      s3_key: s3Key,
      expires_in: 300,
    };
  }

  /**
   * Admin confirms upload of an ITR return PDF. Replaces the existing return
   * for the same person (holder or family member) and AY.
   */
  async confirm(
    adminId: string,
    clientId: string,
    dto: ConfirmItrReturnDto,
  ): Promise<ItrReturn> {
    const client = await this.users.findOneBy({ id: clientId });
    if (!client) throw new NotFoundException('Client not found');
    const memberId = dto.family_member_id ?? null;
    if (memberId) await this.familyMembers.get(clientId, memberId);

    let ret = await this.itrReturns.findOne({
      where: {
        user_id: clientId,
        family_member_id: memberId ?? IsNull(),
        assessment_year: dto.assessment_year,
      },
    });

    if (ret) {
      ret.s3_key = dto.s3_key;
      ret.original_filename = dto.filename;
      ret.file_size_bytes = String(dto.size);
      ret.uploaded_by = adminId;
      ret.uploaded_at = new Date();
    } else {
      ret = this.itrReturns.create({
        user_id: clientId,
        family_member_id: memberId,
        assessment_year: dto.assessment_year,
        s3_key: dto.s3_key,
        original_filename: dto.filename,
        file_size_bytes: String(dto.size),
        uploaded_by: adminId,
        uploaded_at: new Date(),
      });
    }

    const saved = await this.itrReturns.save(ret);

    await this.audit.log(
      adminId,
      'itr_return.uploaded',
      {
        assessment_year: dto.assessment_year,
        family_member_id: memberId,
        filename: dto.filename,
        size: dto.size,
      },
      { user_id: clientId },
    );

    return saved;
  }

  /**
   * Admin lists all ITR returns for a specific client.
   */
  async listForAdmin(clientId: string) {
    const list = await this.itrReturns.find({
      where: { user_id: clientId },
      order: { assessment_year: 'DESC' },
    });

    return Promise.all(
      list.map(async (r) => {
        const downloadUrl = await this.storage.createAttachmentDownloadUrl(
          r.s3_key,
          r.original_filename,
          300,
        );
        return {
          id: r.id,
          family_member_id: r.family_member_id,
          assessment_year: r.assessment_year,
          filename: r.original_filename,
          file_size_bytes: r.file_size_bytes,
          uploaded_at: r.uploaded_at,
          downloadUrl,
        };
      }),
    );
  }

  /**
   * Client gets their own ITR returns with 5-minute attachment download URLs.
   */
  async listMine(userId: string) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');
    if (user.user_type !== UserType.ITR && user.user_type !== UserType.BOTH) {
      throw new ForbiddenException('You do not have access to ITR returns');
    }

    const list = await this.itrReturns.find({
      where: { user_id: userId },
      order: { assessment_year: 'DESC' },
    });

    return Promise.all(
      list.map(async (r) => {
        const downloadUrl = await this.storage.createAttachmentDownloadUrl(
          r.s3_key,
          r.original_filename,
          300,
        );
        return {
          id: r.id,
          family_member_id: r.family_member_id,
          assessment_year: r.assessment_year,
          filename: r.original_filename,
          file_size_bytes: r.file_size_bytes,
          uploaded_at: r.uploaded_at,
          downloadUrl,
        };
      }),
    );
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import {
  GstFilingFrequency,
  ServiceRequestStatus,
  ServiceRequestType,
  UserType,
} from '../common/enums';
import {
  isValidGstin,
  isValidPan,
} from '../common/utils/tax-identifiers.util';
import { ServiceRequest, ServiceRequestPayload, User } from '../entities';
import {
  ChangeClientTypeDto,
  CreateServiceRequestDto,
  ReviewServiceRequestDto,
} from './dto/service-request.dto';

@Injectable()
export class ServiceRequestsService {
  constructor(
    @InjectRepository(ServiceRequest)
    private readonly serviceRequests: Repository<ServiceRequest>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  /**
   * Client creates a new service upgrade request.
   * Enforces at most 1 pending request at a time and strict field validation.
   */
  async create(userId: string, dto: CreateServiceRequestDto): Promise<ServiceRequest> {
    const pending = await this.serviceRequests.findOne({
      where: { user_id: userId, status: ServiceRequestStatus.PENDING },
    });
    if (pending) {
      throw new BadRequestException(
        'You already have a pending service request under review',
      );
    }

    const payload: ServiceRequestPayload = {};

    // Validate GST & BOTH requirements
    if (
      dto.requested_type === ServiceRequestType.GST ||
      dto.requested_type === ServiceRequestType.BOTH
    ) {
      if (!dto.business_name?.trim()) {
        throw new BadRequestException('Business name is required');
      }
      if (!dto.gstin?.trim()) {
        throw new BadRequestException('GSTIN is required');
      }
      const gstinClean = dto.gstin.trim().toUpperCase();
      if (!isValidGstin(gstinClean)) {
        throw new BadRequestException('Invalid GSTIN format or checksum');
      }
      if (!dto.filing_frequency) {
        throw new BadRequestException('Filing frequency is required');
      }
      if (!dto.industry?.trim()) {
        throw new BadRequestException('Industry is required');
      }

      // Enforce GSTIN uniqueness across users (excluding requester)
      const existingGstin = await this.users.findOne({
        where: { gstin: gstinClean, id: Not(userId) },
      });
      if (existingGstin) {
        throw new BadRequestException('A user with this GSTIN already exists');
      }

      payload.business_name = dto.business_name.trim();
      payload.gstin = gstinClean;
      payload.filing_frequency = dto.filing_frequency;
      payload.industry = dto.industry.trim();
    }

    // Validate ITR & BOTH requirements
    if (
      dto.requested_type === ServiceRequestType.ITR ||
      dto.requested_type === ServiceRequestType.BOTH
    ) {
      if (!dto.pan?.trim()) {
        throw new BadRequestException('PAN is required');
      }
      const panClean = dto.pan.trim().toUpperCase();
      if (!isValidPan(panClean)) {
        throw new BadRequestException(
          'Invalid PAN format (expected 10 characters, e.g. ABCDE1234F)',
        );
      }
      payload.pan = panClean;
    }

    const request = this.serviceRequests.create({
      user_id: userId,
      requested_type: dto.requested_type,
      status: ServiceRequestStatus.PENDING,
      payload,
    });

    return this.serviceRequests.save(request);
  }

  /**
   * Client lists their own service requests (newest first).
   */
  async listMine(userId: string): Promise<ServiceRequest[]> {
    return this.serviceRequests.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Admin lists service requests, optionally filtered by status.
   * Includes user relation (name, email, phone).
   */
  async adminList(status?: ServiceRequestStatus): Promise<ServiceRequest[]> {
    const qb = this.serviceRequests
      .createQueryBuilder('sr')
      .leftJoinAndSelect('sr.user', 'user')
      .orderBy('sr.created_at', 'DESC');

    if (status) {
      qb.where('sr.status = :status', { status });
    }

    return qb.getMany();
  }

  /**
   * Admin reviews (approves/rejects) a service request.
   */
  async review(
    adminId: string,
    requestId: string,
    dto: ReviewServiceRequestDto,
  ): Promise<ServiceRequest> {
    const request = await this.serviceRequests.findOne({
      where: { id: requestId },
      relations: { user: true },
    });

    if (!request) {
      throw new NotFoundException('Service request not found');
    }
    if (request.status !== ServiceRequestStatus.PENDING) {
      throw new BadRequestException('Service request is already resolved');
    }

    if (dto.action === 'reject') {
      request.status = ServiceRequestStatus.REJECTED;
      request.reviewed_by = adminId;
      request.reviewed_at = new Date();
      request.note = dto.note ?? null;
      const saved = await this.serviceRequests.save(request);

      await this.audit.log(
        adminId,
        'service_request.rejected',
        { request_id: request.id, note: dto.note },
        { user_id: request.user_id },
      );
      return saved;
    }

    // Action === 'approve'
    const user = await this.users.findOneBy({ id: request.user_id });
    if (!user) throw new NotFoundException('User not found');

    const cur = user.user_type;
    let next: UserType;
    if (request.requested_type === ServiceRequestType.BOTH) {
      next = UserType.BOTH;
    } else if (request.requested_type === ServiceRequestType.GST) {
      next =
        cur === UserType.ITR || cur === UserType.BOTH
          ? UserType.BOTH
          : UserType.GST;
    } else {
      // ITR
      next =
        cur === UserType.GST || cur === UserType.BOTH
          ? UserType.BOTH
          : UserType.ITR;
    }

    user.user_type = next;

    if (request.payload.business_name) {
      user.business_name = request.payload.business_name;
    }
    if (request.payload.gstin) {
      const gstinConflict = await this.users.findOne({
        where: { gstin: request.payload.gstin, id: Not(user.id) },
      });
      if (gstinConflict) {
        throw new BadRequestException('A user with this GSTIN already exists');
      }
      user.gstin = request.payload.gstin;
    }
    if (request.payload.filing_frequency) {
      user.gst_filing_frequency =
        request.payload.filing_frequency as GstFilingFrequency;
    }
    if (request.payload.industry) {
      user.industry = request.payload.industry;
    }
    if (request.payload.pan) {
      user.pan = request.payload.pan;
    }

    await this.users.save(user);

    request.status = ServiceRequestStatus.APPROVED;
    request.reviewed_by = adminId;
    request.reviewed_at = new Date();
    request.note = dto.note ?? null;
    const saved = await this.serviceRequests.save(request);

    // Auto-resolve any other pending requests of that user as rejected with note "superseded"
    await this.serviceRequests.update(
      {
        user_id: user.id,
        status: ServiceRequestStatus.PENDING,
        id: Not(request.id),
      },
      {
        status: ServiceRequestStatus.REJECTED,
        note: 'superseded',
        reviewed_by: adminId,
        reviewed_at: new Date(),
      },
    );

    await this.audit.log(
      adminId,
      'service_request.approved',
      {
        request_id: request.id,
        requested_type: request.requested_type,
        from_type: cur,
        to_type: next,
      },
      { user_id: user.id },
    );

    return saved;
  }

  /**
   * Admin directly changes a client's type.
   * Auto-resolves pending requests and audit logs.
   */
  async changeClientType(
    adminId: string,
    clientId: string,
    dto: ChangeClientTypeDto,
  ): Promise<User> {
    const user = await this.users.findOneBy({ id: clientId });
    if (!user) {
      throw new NotFoundException('Client not found');
    }

    const oldType = user.user_type;
    user.user_type = dto.user_type;
    const saved = await this.users.save(user);

    await this.audit.log(
      adminId,
      'user.type_changed',
      { from_type: oldType, to_type: dto.user_type },
      { user_id: user.id },
    );

    // Auto-resolve any pending requests of that user
    await this.serviceRequests.update(
      { user_id: user.id, status: ServiceRequestStatus.PENDING },
      {
        status: ServiceRequestStatus.REJECTED,
        note: 'handled by direct type change',
        reviewed_by: adminId,
        reviewed_at: new Date(),
      },
    );

    return saved;
  }
}

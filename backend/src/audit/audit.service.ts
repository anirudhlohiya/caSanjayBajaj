import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  paginate,
  PaginatedResult,
  PaginationQueryDto,
} from '../common/dto/pagination';
import { AuditLog } from '../entities/audit-log.entity';

export interface AuditLogFilters extends PaginationQueryDto {
  admin_id?: string;
  action?: string;
  target_user_id?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>,
  ) {}

  async log(
    adminId: string | null,
    action: string,
    detail: Record<string, unknown> = {},
    target?: { user_id?: string; period_id?: string },
  ): Promise<AuditLog> {
    const entry = this.logs.create({
      admin_id: adminId,
      action,
      detail,
      target_user_id: target?.user_id ?? null,
      target_period_id: target?.period_id ?? null,
    });
    return this.logs.save(entry);
  }

  async list(filters: AuditLogFilters): Promise<PaginatedResult<AuditLog>> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const qb = this.logs
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.admin', 'admin')
      .leftJoinAndSelect('log.target_user', 'target_user')
      .orderBy('log.created_at', 'DESC');

    if (filters.admin_id)
      qb.andWhere('log.admin_id = :adminId', { adminId: filters.admin_id });
    if (filters.action)
      qb.andWhere('log.action = :action', { action: filters.action });
    if (filters.target_user_id) {
      qb.andWhere('log.target_user_id = :targetUserId', {
        targetUserId: filters.target_user_id,
      });
    }
    if (filters.from)
      qb.andWhere('log.created_at >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('log.created_at <= :to', { to: filters.to });

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return paginate(items, total, page, pageSize);
  }
}

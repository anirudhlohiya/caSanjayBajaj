import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import { AdminRole, AdminStatus, PERMISSIONS } from '../common/enums';
import { Admin } from '../entities/admin.entity';
import { Permission } from '../entities/permission.entity';
import { AuditService } from '../audit/audit.service';
import {
  CreateAdminDto,
  SetPermissionsDto,
  UpdateAdminDto,
} from './dto/admin.dto';

@Injectable()
export class AdminManagementService {
  constructor(
    @InjectRepository(Admin) private readonly admins: Repository<Admin>,
    @InjectRepository(Permission)
    private readonly permissions: Repository<Permission>,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<Admin[]> {
    return this.admins.find({ order: { created_at: 'DESC' } });
  }

  async create(actorId: string, dto: CreateAdminDto): Promise<Admin> {
    if (dto.role === AdminRole.SUPER_ADMIN) {
      throw new BadRequestException('Cannot create another Super Admin');
    }
    const exists = await this.admins.findOneBy({
      email: dto.email.toLowerCase(),
    });
    if (exists)
      throw new BadRequestException('An admin with this email already exists');

    const admin = await this.admins.save(
      this.admins.create({
        name: dto.name,
        email: dto.email.toLowerCase(),
        password_hash: await argon2.hash(dto.password),
        role: dto.role ?? AdminRole.STAFF,
        status: dto.status ?? AdminStatus.ACTIVE,
      }),
    );
    await this.audit.log(actorId, 'staff.create', {
      target_admin_id: admin.id,
    });
    return admin;
  }

  async findOne(id: string): Promise<Admin> {
    const admin = await this.admins.findOneBy({ id });
    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdateAdminDto,
  ): Promise<Admin> {
    const admin = await this.findOne(id);
    if (admin.role === AdminRole.SUPER_ADMIN && dto.status !== undefined) {
      throw new ForbiddenException('Cannot deactivate the Super Admin');
    }
    Object.assign(admin, dto);
    const saved = await this.admins.save(admin);
    await this.audit.log(actorId, 'staff.update', {
      target_admin_id: id,
      changes: dto,
    });
    return saved;
  }

  async deactivate(actorId: string, id: string): Promise<void> {
    const admin = await this.findOne(id);
    if (admin.role === AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot deactivate the Super Admin');
    }
    admin.status = AdminStatus.INACTIVE;
    await this.admins.save(admin);
    await this.audit.log(actorId, 'staff.deactivate', { target_admin_id: id });
  }

  async getPermissions(adminId: string): Promise<Permission[]> {
    return this.permissions.find({ where: { admin_id: adminId } });
  }

  async setPermissions(
    actorId: string,
    adminId: string,
    dto: SetPermissionsDto,
  ): Promise<Permission[]> {
    const admin = await this.findOne(adminId);
    if (admin.role === AdminRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'Super Admin has implicit permissions; cannot override',
      );
    }

    // Validate keys
    const validKeys = new Set<string>(PERMISSIONS);
    for (const key of dto.permission_keys) {
      if (!validKeys.has(key))
        throw new BadRequestException(`Unknown permission: ${key}`);
    }

    // Remove existing rows then rewrite
    await this.permissions.delete({ admin_id: adminId });
    const rows = dto.permission_keys.map((key) =>
      this.permissions.create({
        admin_id: adminId,
        permission_key: key,
        granted: true,
      }),
    );
    const saved = await this.permissions.save(rows);
    await this.audit.log(actorId, 'staff.permissions', {
      target_admin_id: adminId,
      permissions: dto.permission_keys,
    });
    return saved;
  }

  // Returns a set of granted permission keys for token building (used by AuthService).
  async getGrantedPermissionKeys(adminId: string): Promise<string[]> {
    const rows = await this.permissions.find({
      where: { admin_id: adminId, granted: true },
    });
    return rows.map((r) => r.permission_key);
  }
}

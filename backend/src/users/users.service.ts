import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import sharp from 'sharp';
// Trigger reload
import { StorageService } from '../storage/storage.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  paginate,
  PaginatedResult,
  PaginationQueryDto,
} from '../common/dto/pagination';
import {
  DevicePlatform,
  GstFilingFrequency,
  UserStatus,
  UserType,
} from '../common/enums';
import { AuditService } from '../audit/audit.service';
import { DeviceToken } from '../entities/device-token.entity';
import { User } from '../entities/user.entity';
import {
  ChangePasswordDto,
  CreateUserDto,
  RegisterDeviceTokenDto,
  UpdateProfileDto,
  UpdateUserDto,
} from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(DeviceToken)
    private readonly deviceTokens: Repository<DeviceToken>,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.users.findOneBy({
      email: dto.email.toLowerCase(),
    });
    if (exists)
      throw new BadRequestException('A user with this email already exists');

    if (dto.gstin) {
      const gstinExists = await this.users.findOneBy({
        gstin: dto.gstin.toUpperCase(),
      });
      if (gstinExists) {
        throw new BadRequestException('A user with this GSTIN already exists');
      }
    }

    const password_hash = await argon2.hash(dto.password);
    const user = this.users.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      password_hash,
      phone: dto.phone ?? null,
      gstin: dto.gstin?.toUpperCase() ?? null,
      user_type: dto.user_type ?? UserType.GST,
      status: dto.status ?? UserStatus.ACTIVE,
      gst_filing_frequency:
        dto.gst_filing_frequency ?? GstFilingFrequency.MONTHLY,
    });
    return this.users.save(user);
  }

  async list(query: PaginationQueryDto): Promise<PaginatedResult<User>> {
    const { page, pageSize } = query;
    const [items, total] = await this.users.findAndCount({
      order: { created_at: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return paginate(items, total, page, pageSize);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Admin-side update of a client user. Every cadence change is written to the
   * audit log (docs/13 §3.3 / §11.7) — it only takes effect from the *next*
   * generated month; existing tasks are untouched.
   */
  async update(id: string, dto: UpdateUserDto, adminId: string): Promise<User> {
    const user = await this.findOne(id);
    const previousCadence = user.gst_filing_frequency;
    Object.assign(user, dto);
    const saved = await this.users.save(user);

    if (
      dto.gst_filing_frequency &&
      dto.gst_filing_frequency !== previousCadence
    ) {
      await this.audit.log(
        adminId,
        'user.cadence_changed',
        { from: previousCadence, to: dto.gst_filing_frequency },
        { user_id: saved.id },
      );
    }
    return saved;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    user.status = UserStatus.INACTIVE;
    await this.users.save(user);
  }

  // ----- Client self-service -----

  async getProfile(userId: string): Promise<any> {
    const user = await this.findOne(userId);
    let profile_photo_url = user.profile_photo_url;
    if (profile_photo_url) {
      profile_photo_url = await this.storage.createDownloadUrl(profile_photo_url, 86400); // 1 day
    }
    return { ...user, profile_photo_url };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findOne(userId);
    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.phone !== undefined) user.phone = dto.phone?.trim() || null;
    if (dto.gstin !== undefined) {
      const g = dto.gstin?.trim().toUpperCase() || null;
      user.gstin = g && g.length === 15 ? g : g || null;
    }
    if (dto.dob !== undefined) {
      user.dob = this.parseDateDDMMYYYY(dto.dob);
    }
    await this.users.save(user);
    
    // Return updated profile with signed url
    return this.getProfile(userId);
  }

  async updateProfilePhoto(userId: string, file: Express.Multer.File): Promise<any> {
    const user = await this.findOne(userId);

    const processedBuffer = await sharp(file.buffer)
      .resize({ width: 256, height: 256, fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const s3Key = `profiles/${userId}/${unique}.webp`;

    await this.storage.uploadBuffer(s3Key, processedBuffer, 'image/webp');
    
    user.profile_photo_url = s3Key;
    await this.users.save(user);
    
    return this.getProfile(userId);
  }

  private parseDateDDMMYYYY(dateStr: string): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return new Date(Date.UTC(year, month, day));
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.password_hash')
      .where('user.id = :id', { id: userId })
      .getOne();
    if (!user) throw new NotFoundException('User not found');
    if (!(await argon2.verify(user.password_hash, dto.current_password))) {
      throw new ForbiddenException('Current password is incorrect');
    }
    user.password_hash = await argon2.hash(dto.new_password);
    await this.users.save(user);
  }

  // ----- Device tokens (push) -----

  async registerDeviceToken(
    userId: string,
    dto: RegisterDeviceTokenDto,
  ): Promise<DeviceToken> {
    const existing = await this.deviceTokens.findOneBy({
      user_id: userId,
      push_token: dto.push_token,
    });
    if (existing) return existing;
    const token = this.deviceTokens.create({
      user_id: userId,
      platform: (dto.platform as DevicePlatform) ?? DevicePlatform.PWA,
      push_token: dto.push_token,
    });
    return this.deviceTokens.save(token);
  }

  async listDeviceTokens(userId: string): Promise<DeviceToken[]> {
    return this.deviceTokens.find({ where: { user_id: userId } });
  }

  async unregisterDeviceToken(
    userId: string,
    pushToken: string,
  ): Promise<void> {
    await this.deviceTokens.delete({ user_id: userId, push_token: pushToken });
  }

  // Used by other modules
  async getTokensForPush(userId: string): Promise<DeviceToken[]> {
    return this.deviceTokens.find({ where: { user_id: userId } });
  }

  async listActiveUsers(): Promise<User[]> {
    return this.users.find({ where: { status: UserStatus.ACTIVE } });
  }

  async requireActiveUser(id: string): Promise<User> {
    const user = await this.findOne(id);
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('User account is inactive');
    }
    return user;
  }

  static isSelf(auth: AuthUser, userId: string): boolean {
    return auth.type === 'user' && auth.sub === userId;
  }
}

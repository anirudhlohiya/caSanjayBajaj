import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  paginate,
  PaginatedResult,
  PaginationQueryDto,
} from '../common/dto/pagination';
import { DevicePlatform, UserStatus, UserType } from '../common/enums';
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
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.users.findOneBy({
      email: dto.email.toLowerCase(),
    });
    if (exists)
      throw new BadRequestException('A user with this email already exists');
    const password_hash = await argon2.hash(dto.password);
    const user = this.users.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      password_hash,
      phone: dto.phone ?? null,
      gstin: dto.gstin ?? null,
      user_type: dto.user_type ?? UserType.GST,
      status: dto.status ?? UserStatus.ACTIVE,
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

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    return this.users.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    user.status = UserStatus.INACTIVE;
    await this.users.save(user);
  }

  // ----- Client self-service -----

  async getProfile(userId: string): Promise<User> {
    return this.findOne(userId);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findOne(userId);
    Object.assign(user, dto);
    return this.users.save(user);
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

import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import {
  AdminRole,
  AdminStatus,
  SubjectType,
  UserStatus,
} from '../common/enums';
import { Admin } from '../entities/admin.entity';
import { Permission } from '../entities/permission.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';
import { AuthTokensDto, LoginDto, RefreshDto } from './dto/auth.dto';

interface TokenPayload {
  sub: string;
  type: 'user' | 'admin';
  email: string;
  role?: string;
  permissions?: string[];
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Admin) private readonly admins: Repository<Admin>,
    @InjectRepository(Permission)
    private readonly permissions: Repository<Permission>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
  ) {}

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  async loginUser(dto: LoginDto): Promise<AuthTokensDto> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.password_hash')
      .where('LOWER(user.email) = LOWER(:email)', { email: dto.email })
      .getOne();

    if (
      !user ||
      !(await this.verifyPassword(user.password_hash, dto.password))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account is inactive');
    }

    const payload: TokenPayload = {
      sub: user.id,
      type: 'user',
      email: user.email,
    };
    return this.issueTokens(payload, SubjectType.USER, user.id);
  }

  async loginAdmin(dto: LoginDto): Promise<AuthTokensDto> {
    const admin = await this.admins
      .createQueryBuilder('admin')
      .addSelect('admin.password_hash')
      .where('LOWER(admin.email) = LOWER(:email)', { email: dto.email })
      .getOne();

    if (
      !admin ||
      !(await this.verifyPassword(admin.password_hash, dto.password))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (admin.status !== AdminStatus.ACTIVE) {
      throw new ForbiddenException('Account is inactive');
    }

    const payload = await this.buildAdminPayload(admin);
    return this.issueTokens(payload, SubjectType.ADMIN, admin.id);
  }

  private async buildAdminPayload(admin: Admin): Promise<TokenPayload> {
    const payload: TokenPayload = {
      sub: admin.id,
      type: 'admin',
      email: admin.email,
      role: admin.role,
    };
    if (admin.role === AdminRole.STAFF) {
      const perms = await this.permissions.find({
        where: { admin_id: admin.id, granted: true },
      });
      payload.permissions = perms.map((p) => p.permission_key);
    } else {
      payload.permissions = undefined;
    }
    return payload;
  }

  private async issueTokens(
    payload: TokenPayload,
    subjectType: SubjectType,
    subjectId: string,
  ): Promise<AuthTokensDto> {
    const access_token = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as never,
    });

    const refreshSecret = process.env.JWT_REFRESH_SECRET ?? '';
    const refreshTtl = process.env.JWT_REFRESH_TTL ?? '30d';
    const refresh_token = this.jwtService.sign(
      { sub: subjectId, type: subjectType },
      { secret: refreshSecret, expiresIn: refreshTtl as never },
    );

    // Store only a hash of the refresh token server-side
    const tokenHash = this.hashToken(refresh_token);
    const expiresAt = new Date(Date.now() + this.ttlToMs(refreshTtl));
    await this.refreshTokens.save(
      this.refreshTokens.create({
        subject_type: subjectType,
        subject_id: subjectId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      }),
    );

    return {
      access_token,
      refresh_token,
      token_type: 'Bearer',
      expires_in: 900,
    };
  }

  async refresh(dto: RefreshDto): Promise<AuthTokensDto> {
    const tokenHash = this.hashToken(dto.refresh_token);
    const record = await this.refreshTokens.findOne({
      where: { token_hash: tokenHash },
    });
    if (!record || record.revoked_at) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (record.expires_at < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Rotate: revoke old, issue new pair
    await this.refreshTokens.update(record.id, { revoked_at: new Date() });

    let payload: TokenPayload;
    if (record.subject_type === SubjectType.ADMIN) {
      const admin = await this.admins.findOneBy({ id: record.subject_id });
      if (!admin || admin.status !== AdminStatus.ACTIVE) {
        throw new UnauthorizedException('Admin no longer active');
      }
      payload = await this.buildAdminPayload(admin);
    } else {
      const user = await this.users.findOneBy({ id: record.subject_id });
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('User no longer active');
      }
      payload = { sub: user.id, type: 'user', email: user.email };
    }

    return this.issueTokens(payload, record.subject_type, record.subject_id);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.refreshTokens.update(
      { token_hash: tokenHash },
      { revoked_at: new Date() },
    );
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private ttlToMs(ttl: string): number {
    const match = /^(\d+)(s|m|h|d)$/.exec(ttl);
    if (!match) return 30 * 24 * 60 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * multipliers[unit];
  }
}

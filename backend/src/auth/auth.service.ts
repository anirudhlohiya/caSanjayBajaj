import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import { Repository, IsNull } from 'typeorm';
import {
  AdminRole,
  AdminStatus,
  SubjectType,
  UserStatus,
  UserType,
} from '../common/enums';
import { Admin } from '../entities/admin.entity';
import { ClientPreRegistration } from '../entities/client-pre-registration.entity';
import { Permission } from '../entities/permission.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';
import { OtpVerification } from '../entities/otp-verification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthTokensDto, LoginDto, RefreshDto } from './dto/auth.dto';
import {
  SendOtpDto,
  VerifyOtpDto,
  SignupDto,
  ResetPasswordDto,
} from './dto/otp.dto';

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
    @InjectRepository(OtpVerification)
    private readonly otpVerifications: Repository<OtpVerification>,
    @InjectRepository(ClientPreRegistration)
    private readonly preRegistrations: Repository<ClientPreRegistration>,
    private readonly notifications: NotificationsService,
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

  async sendOtp(dto: SendOtpDto): Promise<{ success: boolean }> {
    const emailLower = dto.email.toLowerCase();

    if (dto.purpose === 'signup') {
      const userExists = await this.users.findOne({
        where: { email: emailLower },
      });
      if (userExists) {
        throw new BadRequestException('Email is already registered');
      }
    } else if (dto.purpose === 'reset_password') {
      const userExists = await this.users.findOne({
        where: { email: emailLower },
      });
      if (!userExists) {
        throw new BadRequestException('Email is not registered');
      }
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.otpVerifications.delete({
      email: emailLower,
      purpose: dto.purpose,
    });
    await this.otpVerifications.save(
      this.otpVerifications.create({
        email: emailLower,
        otp_code: this.hashToken(otpCode),
        purpose: dto.purpose,
        expires_at: expiresAt,
        verified: false,
      }),
    );

    const subject =
      dto.purpose === 'signup'
        ? 'Filing App — Email Verification OTP'
        : 'Filing App — Password Reset OTP';

    const actionText =
      dto.purpose === 'signup' ? 'verify your email' : 'reset your password';
    const htmlBody = `
      <div style="font-family: sans-serif; padding: 20px; color: #191c1e; background-color: #f7f9fb;">
        <h2 style="color: #001433;">S N BAJAJ AND CO</h2>
        <p>You requested an OTP to ${actionText}.</p>
        <div style="font-size: 24px; font-weight: bold; padding: 15px 0; letter-spacing: 2px; color: #305ea4;">
          ${otpCode}
        </div>
        <p style="font-size: 13px; color: #74777f;">
          This code is valid for 5 minutes. If you did not make this request, please ignore this email.
        </p>
      </div>
    `;

    await this.notifications.sendEmail(
      { email: emailLower },
      subject,
      htmlBody,
    );

    return { success: true };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{ success: boolean }> {
    const emailLower = dto.email.toLowerCase();

    const record = await this.otpVerifications.findOne({
      where: { email: emailLower, purpose: dto.purpose, verified: false },
      order: { created_at: 'DESC' },
    });

    if (!record) {
      throw new BadRequestException(
        'No verification request found for this email',
      );
    }

    if (record.expires_at < new Date()) {
      throw new BadRequestException(
        'OTP has expired. Please request a new one',
      );
    }

    if (record.otp_code !== this.hashToken(dto.otp_code)) {
      throw new BadRequestException('Invalid OTP code');
    }

    record.verified = true;
    await this.otpVerifications.save(record);

    return { success: true };
  }

  async signup(dto: SignupDto): Promise<AuthTokensDto> {
    const emailLower = dto.email.toLowerCase();

    const verification = await this.otpVerifications.findOne({
      where: { email: emailLower, purpose: 'signup', verified: true },
      order: { updated_at: 'DESC' },
    });

    if (!verification) {
      throw new BadRequestException(
        'Email not verified. Please request and verify OTP first',
      );
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (verification.updated_at < tenMinutesAgo) {
      throw new BadRequestException(
        'Verification expired. Please request a new OTP',
      );
    }

    const exists = await this.users.findOne({ where: { email: emailLower } });
    if (exists) {
      throw new BadRequestException('Email is already registered');
    }

    const gstinUpper = dto.gstin?.toUpperCase() ?? null;
    const userType = gstinUpper ? UserType.GST : UserType.ITR;

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.users.save(
      this.users.create({
        name: dto.name,
        email: emailLower,
        password_hash: passwordHash,
        phone: dto.phone ?? null,
        gstin: gstinUpper,
        user_type: userType,
        status: UserStatus.ACTIVE,
      }),
    );

    // Auto-link pre-registered client if GSTIN matches
    if (gstinUpper) {
      const preReg = await this.preRegistrations.findOne({
        where: { gstin: gstinUpper, linked_user_id: IsNull() },
      });
      if (preReg) {
        preReg.linked_user_id = user.id;
        await this.preRegistrations.save(preReg);
        // Update user with pre-registration data if fields were empty
        if (!user.phone && preReg.phone) {
          user.phone = preReg.phone;
          await this.users.save(user);
        }
      }
    }

    await this.otpVerifications.delete({
      email: emailLower,
      purpose: 'signup',
    });

    const payload: TokenPayload = {
      sub: user.id,
      type: 'user',
      email: user.email,
    };
    return this.issueTokens(payload, SubjectType.USER, user.id);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: boolean }> {
    const emailLower = dto.email.toLowerCase();

    const verification = await this.otpVerifications.findOne({
      where: { email: emailLower, purpose: 'reset_password', verified: true },
      order: { updated_at: 'DESC' },
    });

    if (!verification) {
      throw new BadRequestException(
        'Email not verified. Please request and verify OTP first',
      );
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (verification.updated_at < tenMinutesAgo) {
      throw new BadRequestException(
        'Verification expired. Please request a new OTP',
      );
    }

    const user = await this.users.findOne({ where: { email: emailLower } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const passwordHash = await argon2.hash(dto.password);
    await this.users.update(user.id, { password_hash: passwordHash });

    await this.otpVerifications.delete({
      email: emailLower,
      purpose: 'reset_password',
    });

    return { success: true };
  }
}

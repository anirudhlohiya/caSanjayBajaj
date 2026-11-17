import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { AuthUser } from '../decorators/current-user.decorator';

interface AdminAccessRow {
  status: string;
  role: string;
  sessions_valid_from: Date | null;
  permissions: string[];
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }
    let payload: AuthUser;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    if (payload.type === 'admin') {
      await refreshAdminAccess(this.dataSource, payload);
    }
    request.user = payload;
    return true;
  }

  private extractToken(request: Request): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer' && token) {
      return token;
    }
    if (typeof request.query?.['token'] === 'string') {
      return request.query['token'];
    }
    return null;
  }
}

/**
 * The token only proves who the admin is. Status, role and permissions are
 * read from the database on every request, so deactivating a staff member
 * or removing a permission takes effect on their very next request.
 * Overwrites role + permissions on the payload; throws 401 if the account or
 * this session is no longer valid.
 */
export async function refreshAdminAccess(
  dataSource: DataSource,
  payload: AuthUser,
): Promise<void> {
  const rows: AdminAccessRow[] = await dataSource.query(
    `SELECT a.status, a.role, a.sessions_valid_from,
            COALESCE(array_agg(p.permission_key)
                     FILTER (WHERE p.granted), '{}') AS permissions
       FROM admins a
       LEFT JOIN permissions p ON p.admin_id = a.id
      WHERE a.id = $1
      GROUP BY a.id`,
    [payload.sub],
  );
  const admin = rows[0];
  if (!admin || admin.status !== 'active') {
    throw new UnauthorizedException('Account is no longer active');
  }
  // Tokens issued before a password reset / deactivation are dead. iat is in
  // whole seconds, so a token from that same second is refused too (<=).
  if (
    admin.sessions_valid_from &&
    (payload.iat ?? 0) <=
      Math.floor(new Date(admin.sessions_valid_from).getTime() / 1000)
  ) {
    throw new UnauthorizedException('Session ended, please sign in again');
  }
  payload.role = admin.role;
  payload.permissions = admin.permissions;
}

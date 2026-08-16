import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthUser } from '../decorators/current-user.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const user = request.user;
    if (!user || user.type !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    if (user.role && roles.includes(user.role)) return true;

    throw new ForbiddenException('Insufficient role');
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const user = request.user;
    if (!user || user.type !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    // Super admin implicitly has all permissions
    if (user.role === 'super_admin') return true;

    const granted = new Set(user.permissions ?? []);
    const ok = required.every((p) => granted.has(p));
    if (!ok)
      throw new ForbiddenException(
        `Missing permission: ${required.join(', ')}`,
      );
    return true;
  }
}

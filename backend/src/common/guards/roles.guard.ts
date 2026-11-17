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
import { expandPermissions } from '../enums';

/** True when this signed-in admin holds every one of the given permissions. */
export function adminCan(user: AuthUser, ...required: string[]): boolean {
  if (user.type !== 'admin') return false;
  if (user.role === 'super_admin') return true;
  const granted = new Set(expandPermissions(user.permissions ?? []));
  return required.every((p) => granted.has(p));
}

/**
 * For endpoints shared by clients and admins (no @Permissions on the route):
 * clients pass through to the service's own ownership check, admins must hold
 * the permission.
 */
export function assertAdminCan(user: AuthUser, ...required: string[]): void {
  if (user.type === 'admin' && !adminCan(user, ...required)) {
    throw new ForbiddenException('You do not have access to do this');
  }
}

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
    if (!adminCan(user, ...required)) {
      throw new ForbiddenException('You do not have access to do this');
    }
    return true;
  }
}

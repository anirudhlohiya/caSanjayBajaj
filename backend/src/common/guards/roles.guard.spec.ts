import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard, RolesGuard } from './roles.guard';

function makeCtx(user: unknown) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as never;
}

describe('PermissionsGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;

  it('allows super admin without explicit permissions', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['view_clients']);
    const guard = new PermissionsGuard(reflector);
    const result = guard.canActivate(
      makeCtx({ type: 'admin', sub: 'a1', role: 'super_admin' }),
    );
    expect(result).toBe(true);
  });

  it('allows staff with the required permission', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['upload_reports']);
    const guard = new PermissionsGuard(reflector);
    const result = guard.canActivate(
      makeCtx({
        type: 'admin',
        sub: 'a2',
        role: 'staff',
        permissions: ['view_clients', 'upload_reports'],
      }),
    );
    expect(result).toBe(true);
  });

  it('blocks staff missing a required permission', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['send_reminders']);
    const guard = new PermissionsGuard(reflector);
    expect(() =>
      guard.canActivate(
        makeCtx({
          type: 'admin',
          sub: 'a3',
          role: 'staff',
          permissions: ['view_clients'],
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('passes through when no permissions required', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(undefined);
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(makeCtx({ type: 'user' }))).toBe(true);
  });
});

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;

  it('passes through when no roles required', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(undefined);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeCtx({}))).toBe(true);
  });

  it('allows matching role', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['super_admin']);
    const guard = new RolesGuard(reflector);
    expect(
      guard.canActivate(
        makeCtx({ type: 'admin', sub: 'a1', role: 'super_admin' }),
      ),
    ).toBe(true);
  });

  it('blocks non-admin', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['super_admin']);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeCtx({ type: 'user' }))).toThrow(
      ForbiddenException,
    );
  });
});

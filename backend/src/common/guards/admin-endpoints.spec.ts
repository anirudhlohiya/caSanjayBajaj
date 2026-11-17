import 'reflect-metadata';
import { AppModule } from '../../app.module';
import { PERMISSIONS } from '../enums';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard, RolesGuard } from './roles.guard';

type Ctor = { name: string; prototype: Record<string, unknown> };

/** Every controller reachable from AppModule. */
function allControllers(root: unknown): Ctor[] {
  const seen = new Set<unknown>();
  const out = new Set<Ctor>();
  const visit = (node: unknown) => {
    const dyn = node as { module?: unknown; imports?: unknown[] };
    const mod = dyn?.module ?? node;
    if (!mod || seen.has(mod)) return;
    seen.add(mod);
    const meta = (key: string): unknown[] =>
      (Reflect.getMetadata(key, mod) as unknown[]) ?? [];
    meta('controllers').forEach((c) => out.add(c as Ctor));
    [...meta('imports'), ...(dyn?.imports ?? [])].forEach(visit);
  };
  visit(root);
  return [...out];
}

// Reached with a one-time secret key by the OnlyOffice server, or the login itself.
const PUBLIC_BY_DESIGN = new Set([
  'admin/rent-agreements/office/source/:key',
  'admin/rent-agreements/office/callback/:key',
  'auth/login/admin',
]);

describe('admin endpoints', () => {
  const routes = allControllers(AppModule).flatMap((ctrl) => {
    const base = [Reflect.getMetadata('path', ctrl) ?? ''].flat()[0] as string;
    return Object.getOwnPropertyNames(ctrl.prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => ctrl.prototype[name])
      .filter(
        (fn): fn is () => unknown =>
          typeof fn === 'function' && Reflect.hasMetadata('path', fn),
      )
      .flatMap((fn) =>
        [Reflect.getMetadata('path', fn)].flat().map((p: string) => ({
          path: [base, p].filter((s) => s && s !== '/').join('/'),
          ctrl,
          fn,
        })),
      );
  });
  const adminRoutes = routes.filter(
    (r) =>
      (/(^|\/)admin(\/|$)/.test(r.path) ||
        r.path.startsWith('whatsapp-chats')) &&
      !PUBLIC_BY_DESIGN.has(r.path),
  );

  it('finds the admin routes', () => {
    expect(adminRoutes.length).toBeGreaterThan(100);
  });

  it.each(adminRoutes.map((r) => [r.path, r]))(
    '%s needs a signed-in admin with a permission or role',
    (_path, r) => {
      const pick = <T>(key: string): T[] =>
        (Reflect.getMetadata(key, r.fn) as T[]) ??
        (Reflect.getMetadata(key, r.ctrl) as T[]) ??
        [];
      const guards = [
        ...((Reflect.getMetadata('__guards__', r.ctrl) as unknown[]) ?? []),
        ...((Reflect.getMetadata('__guards__', r.fn) as unknown[]) ?? []),
      ];
      const permissions = pick<string>('permissions');
      const roles = pick<string>('roles');

      expect(guards).toContain(JwtAuthGuard);
      expect(permissions.length + roles.length).toBeGreaterThan(0);
      if (permissions.length) expect(guards).toContain(PermissionsGuard);
      if (roles.length) expect(guards).toContain(RolesGuard);
      permissions.forEach((p) => expect(PERMISSIONS).toContain(p));
    },
  );
});

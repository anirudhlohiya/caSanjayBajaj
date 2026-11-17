import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AuthUser } from '../decorators/current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

const NOW = 1_800_000_000; // token iat, seconds

function run(tokenPayload: object, adminRow?: object) {
  const jwt = {
    verifyAsync: jest.fn().mockResolvedValue({ ...tokenPayload }),
  } as unknown as JwtService;
  const query = jest.fn().mockResolvedValue(adminRow ? [adminRow] : []);
  const guard = new JwtAuthGuard(jwt, { query } as unknown as DataSource);
  const request: { headers: object; query: object; user?: AuthUser } = {
    headers: { authorization: 'Bearer t' },
    query: {},
  };
  const ctx = { switchToHttp: () => ({ getRequest: () => request }) } as never;
  return { result: guard.canActivate(ctx), request, query };
}

const staffToken = {
  sub: 'a1',
  type: 'admin',
  role: 'staff',
  permissions: ['view_clients', 'manage_clients'], // stale copy in the token
  iat: NOW,
};
const activeRow = {
  status: 'active',
  role: 'staff',
  sessions_valid_from: null,
  permissions: ['view_documents'],
};

describe('JwtAuthGuard (admin tokens)', () => {
  it('uses the permissions in the database, not the ones in the token', async () => {
    const { result, request } = run(staffToken, activeRow);
    await expect(result).resolves.toBe(true);
    expect(request.user?.permissions).toEqual(['view_documents']);
  });

  it('refuses a deactivated staff member whose token has not expired', async () => {
    const { result } = run(staffToken, { ...activeRow, status: 'inactive' });
    await expect(result).rejects.toThrow(UnauthorizedException);
  });

  it('refuses an admin that no longer exists', async () => {
    await expect(run(staffToken).result).rejects.toThrow(UnauthorizedException);
  });

  it('refuses tokens issued before the sessions were ended', async () => {
    const { result } = run(staffToken, {
      ...activeRow,
      sessions_valid_from: new Date((NOW + 60) * 1000),
    });
    await expect(result).rejects.toThrow(UnauthorizedException);
  });

  it('accepts tokens issued after the sessions were ended', async () => {
    const { result } = run(staffToken, {
      ...activeRow,
      sessions_valid_from: new Date((NOW - 60) * 1000),
    });
    await expect(result).resolves.toBe(true);
  });

  it('does not query admins for client tokens', async () => {
    const { result, query } = run({ sub: 'u1', type: 'user' });
    await expect(result).resolves.toBe(true);
    expect(query).not.toHaveBeenCalled();
  });
});

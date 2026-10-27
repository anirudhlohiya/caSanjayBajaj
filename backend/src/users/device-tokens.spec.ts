import { FindOperator, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { DevicePlatform } from '../common/enums';
import { DeviceToken } from '../entities/device-token.entity';
import { User } from '../entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { UsersService } from './users.service';

describe('UsersService device tokens', () => {
  let rows: DeviceToken[];
  let service: UsersService;

  const matches = (r: DeviceToken, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) =>
      v instanceof FindOperator
        ? r[k as keyof DeviceToken] !== v.value
        : r[k as keyof DeviceToken] === v,
    );

  beforeEach(() => {
    rows = [];
    const repo = {
      delete: jest.fn((where: Record<string, unknown>) => {
        rows = rows.filter((r) => !matches(r, where));
        return Promise.resolve();
      }),
      findOneBy: jest.fn((where: Record<string, unknown>) =>
        Promise.resolve(rows.find((r) => matches(r, where)) ?? null),
      ),
      create: jest.fn((v: Partial<DeviceToken>) => v),
      save: jest.fn((v: DeviceToken) => {
        if (!rows.includes(v)) rows.push(v);
        return Promise.resolve(v);
      }),
    };
    service = new UsersService(
      {} as Repository<User>,
      repo as unknown as Repository<DeviceToken>,
      {} as AuditService,
      {} as StorageService,
    );
  });

  it("moves a shared phone to whoever signed in last, so the previous user's alerts stop", async () => {
    await service.registerDeviceToken('mother', {
      push_token: 'phone-1',
      platform: 'android',
    });
    await service.registerDeviceToken('son', {
      push_token: 'phone-1',
      platform: 'android',
    });
    expect(rows.map((r) => r.user_id)).toEqual(['son']);
  });

  it('does not duplicate a device registered twice by the same user', async () => {
    await service.registerDeviceToken('u1', { push_token: 'web-1' });
    await service.registerDeviceToken('u1', { push_token: 'web-1' });
    expect(rows).toHaveLength(1);
    expect(rows[0].platform).toBe(DevicePlatform.PWA);
  });
});

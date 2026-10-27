import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { UserStatus } from '../common/enums';
import { DeviceToken } from '../entities/device-token.entity';
import { User } from '../entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { UsersService } from './users.service';

describe('UsersService.update (staff)', () => {
  const build = (user: Partial<User>) => {
    const users = {
      findOneBy: jest.fn().mockResolvedValue(user),
      save: jest.fn((u: User) => Promise.resolve(u)),
    };
    return new UsersService(
      users as unknown as Repository<User>,
      {} as Repository<DeviceToken>,
      { log: jest.fn() } as unknown as AuditService,
      {} as StorageService,
    );
  };

  it('reopening an account cancels a pending self-service deletion', async () => {
    const service = build({
      id: 'u1',
      status: UserStatus.INACTIVE,
      deletion_requested_at: new Date(),
      deleted_at: null,
    });
    const saved = await service.update(
      'u1',
      { status: UserStatus.ACTIVE },
      'admin-1',
    );
    expect(saved.status).toBe(UserStatus.ACTIVE);
    expect(saved.deletion_requested_at).toBeNull();
  });

  it('other edits leave a pending deletion in place', async () => {
    const requested = new Date();
    const service = build({
      id: 'u1',
      status: UserStatus.INACTIVE,
      deletion_requested_at: requested,
      deleted_at: null,
    });
    const saved = await service.update('u1', { name: 'New Name' }, 'admin-1');
    expect(saved.deletion_requested_at).toBe(requested);
  });
});

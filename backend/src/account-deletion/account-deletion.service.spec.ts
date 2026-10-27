import { ForbiddenException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { UserStatus } from '../common/enums';
import { User } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ServicesOfferedService } from '../services-offered/services-offered.service';
import { StorageService } from '../storage/storage.service';
import { AccountDeletionService } from './account-deletion.service';

const DAY = 24 * 60 * 60 * 1000;

describe('AccountDeletionService', () => {
  let user: User & { password_hash: string };
  let users: {
    createQueryBuilder: jest.Mock;
    update: jest.Mock;
    find: jest.Mock;
  };
  let manager: { query: jest.Mock; update: jest.Mock };
  let audit: { log: jest.Mock };
  let storage: { deleteObject: jest.Mock };
  let notifications: { sendEmail: jest.Mock };
  let service: AccountDeletionService;

  // argon2 is deliberately slow: hash once, not per test
  let passwordHash: string;
  beforeAll(async () => {
    passwordHash = await argon2.hash('secret-pass');
  });

  beforeEach(() => {
    user = {
      id: 'u1',
      name: 'Asha Patel',
      email: 'asha@example.com',
      password_hash: passwordHash,
      phone: '+919900000000',
      pan: 'ABCDE1234F',
      gstin: '24ABCDE1234F1Z5',
      status: UserStatus.ACTIVE,
      profile_photo_url: 'profiles/u1/me.webp',
      deletion_requested_at: null,
      deleted_at: null,
    } as unknown as User & { password_hash: string };
    users = {
      createQueryBuilder: jest.fn(() => ({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(user),
      })),
      update: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    manager = {
      query: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    };
    const dataSource = {
      transaction: (cb: (m: typeof manager) => Promise<unknown>) => cb(manager),
    } as unknown as DataSource;
    audit = { log: jest.fn() };
    storage = { deleteObject: jest.fn().mockResolvedValue(undefined) };
    notifications = { sendEmail: jest.fn().mockResolvedValue(true) };
    const firm = {
      getContact: jest.fn().mockResolvedValue({ email: 'office@firm.test' }),
    } as unknown as ServicesOfferedService;
    service = new AccountDeletionService(
      users as unknown as Repository<User>,
      dataSource,
      audit as unknown as AuditService,
      storage as unknown as StorageService,
      notifications as unknown as NotificationsService,
      firm,
    );
  });

  const sql = () =>
    (manager.query.mock.calls as [string][]).map((c) => String(c[0]));
  const userChanges = () =>
    (manager.update.mock.calls as [unknown, string, Partial<User>][])[0];
  const email = () =>
    (
      notifications.sendEmail.mock.calls as [
        { email: string },
        string,
        string,
      ][]
    )[0];
  const findWhere = () =>
    (
      users.find.mock.calls as [
        {
          where: {
            status: UserStatus;
            deletion_requested_at: { value: Date };
          };
        },
      ][]
    )[0][0].where;

  describe('request', () => {
    it('rejects a wrong password and changes nothing', async () => {
      await expect(service.request('u1', 'nope')).rejects.toThrow(
        ForbiddenException,
      );
      expect(manager.update).not.toHaveBeenCalled();
      expect(notifications.sendEmail).not.toHaveBeenCalled();
    });

    it('locks the account, signs out everywhere and emails the firm', async () => {
      const before = Date.now();
      const { delete_after } = await service.request('u1', 'secret-pass');

      const [, id, changes] = userChanges();
      expect(id).toBe('u1');
      expect(changes.status).toBe(UserStatus.INACTIVE);
      expect(changes.deletion_requested_at).toBeInstanceOf(Date);
      expect(sql().some((q) => q.includes('UPDATE "refresh_tokens"'))).toBe(
        true,
      );
      expect(sql().some((q) => q.includes('DELETE FROM "device_tokens"'))).toBe(
        true,
      );

      const wait = new Date(delete_after).getTime() - before;
      expect(wait).toBeGreaterThanOrEqual(30 * DAY - 1000);
      expect(wait).toBeLessThanOrEqual(30 * DAY + 1000);

      const [to, subject, body] = email();
      expect(to.email).toBe('office@firm.test');
      expect(subject).toContain('Asha Patel');
      expect(body).toContain('ABCDE1234F');
    });

    it('still succeeds when the firm email fails', async () => {
      notifications.sendEmail.mockRejectedValue(new Error('SES down'));
      await expect(
        service.request('u1', 'secret-pass'),
      ).resolves.toHaveProperty('delete_after');
    });
  });

  describe('cancelIfPending', () => {
    it('reopens an account whose deletion is pending', async () => {
      user.status = UserStatus.INACTIVE;
      user.deletion_requested_at = new Date();

      expect(await service.cancelIfPending(user)).toBe(true);
      expect(users.update).toHaveBeenCalledWith('u1', {
        status: UserStatus.ACTIVE,
        deletion_requested_at: null,
      });
      expect(user.status).toBe(UserStatus.ACTIVE);
    });

    it('leaves accounts deactivated by staff, or already erased, alone', async () => {
      user.status = UserStatus.INACTIVE;
      expect(await service.cancelIfPending(user)).toBe(false);

      user.deletion_requested_at = new Date();
      user.deleted_at = new Date();
      expect(await service.cancelIfPending(user)).toBe(false);
      expect(users.update).not.toHaveBeenCalled();
    });
  });

  describe('erase', () => {
    it('erases login and personal details but keeps tax identity', async () => {
      manager.query.mockImplementation((q: string) =>
        Promise.resolve(
          q.includes('ticket_attachments')
            ? [{ s3_key: 'tickets/t1/receipt.pdf' }]
            : [],
        ),
      );

      await service.erase(user);

      const changes = userChanges()[2];
      expect(changes).toMatchObject({
        email: 'deleted-u1@deleted.invalid',
        phone: null,
        dob: null,
        profile_photo_url: null,
      });
      expect(changes.deleted_at).toBeInstanceOf(Date);
      expect(changes.password_hash).not.toBe(user.password_hash);
      // Tax identity stays
      expect(changes).not.toHaveProperty('name');
      expect(changes).not.toHaveProperty('pan');
      expect(changes).not.toHaveProperty('gstin');
      expect(changes).not.toHaveProperty('business_name');

      for (const table of [
        'tickets',
        'reminders',
        'report_notifications',
        'device_tokens',
        'whatsapp_conversations',
        'refresh_tokens',
      ]) {
        expect(sql().some((q) => q.includes(`DELETE FROM "${table}"`))).toBe(
          true,
        );
      }
      // Filings and documents are never touched
      expect(
        sql().some((q) =>
          /DELETE FROM "(documents|itr_returns|family_members|reports)"/.test(
            q,
          ),
        ),
      ).toBe(false);

      expect(storage.deleteObject).toHaveBeenCalledWith(
        'tickets/t1/receipt.pdf',
      );
      expect(storage.deleteObject).toHaveBeenCalledWith('profiles/u1/me.webp');
    });
  });

  describe('eraseDue', () => {
    it('erases only accounts past the 30-day wait', async () => {
      const now = new Date('2026-12-01T00:00:00Z');
      users.find.mockResolvedValue([user]);

      expect(await service.eraseDue(now)).toBe(1);

      const where = findWhere();
      expect(where.status).toBe(UserStatus.INACTIVE);
      expect(where.deletion_requested_at.value).toEqual(
        new Date(now.getTime() - 30 * DAY),
      );
      expect(manager.update).toHaveBeenCalled();
    });

    it('keeps going when one account fails', async () => {
      const other = { ...user, id: 'u2' };
      users.find.mockResolvedValue([user, other]);
      manager.update
        .mockRejectedValueOnce(new Error('db hiccup'))
        .mockResolvedValueOnce(undefined);

      expect(await service.eraseDue(new Date())).toBe(1);
    });
  });
});

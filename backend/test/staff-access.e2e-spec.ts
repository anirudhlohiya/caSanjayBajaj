import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { Admin, Document, User, entities } from '../src/entities';
import {
  AdminRole,
  AdminStatus,
  DocumentCategory,
  DocumentFileType,
  DocumentStatus,
  UserStatus,
  UserType,
} from '../src/common/enums';
import { StaffAccessControl1800000000009 } from '../src/database/migrations/1800000000009-StaffAccessControl';
import { NotificationsService } from '../src/notifications/notifications.service';
import { StorageService } from '../src/storage/storage.service';

// Staff access against a real PostgreSQL (all migrations applied): what a
// staff member can reach, and that removing access works on a token that is
// still valid. Runs only when E2E_ENABLED=true; S3 / email mocked.
const runFlow = process.env.E2E_ENABLED === 'true' ? describe : describe.skip;
// Migrations, password hashing and the 1-second waits need more than the 5 s default.
jest.setTimeout(30_000);

const DB = {
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
};
const ephemeralDb = `ca_staff_e2e_${Date.now()}`;

const BOSS = { email: 'boss@example.com', password: 'Boss@12345' };
const STAFF = { email: 'staff@example.com', password: 'Staff@12345' };

interface Tokens {
  access_token: string;
  refresh_token: string;
}

runFlow('Staff access (e2e)', () => {
  let app: INestApplication<App>;
  let ds: DataSource;
  let boss: string; // super admin access token
  let staffId: string;
  let docId: string;

  const api = () => request(app.getHttpServer());
  const login = (who: { email: string; password: string }) =>
    api().post('/api/v1/auth/login/admin').send(who);
  const get = (token: string, url: string) =>
    api()
      .get(`/api/v1${url}`)
      .set({ Authorization: `Bearer ${token}` });
  const send = (
    token: string,
    method: 'post' | 'put' | 'patch' | 'delete',
    url: string,
    body: object = {},
  ) =>
    api()
      [method](`/api/v1${url}`)
      .set({ Authorization: `Bearer ${token}` })
      .send(body);
  const setAccess = (keys: string[]) =>
    send(boss, 'put', `/admin/staff/${staffId}/permissions`, {
      permission_keys: keys,
    }).expect(200);
  const staffLogin = async () =>
    (await login(STAFF).expect(200)).body as Tokens;

  beforeAll(async () => {
    const maintenance = new Client({ ...DB, database: 'postgres' });
    await maintenance.connect();
    await maintenance.query(`CREATE DATABASE "${ephemeralDb}"`);
    await maintenance.end();

    process.env.DB_NAME = ephemeralDb;
    process.env.JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET ?? 'e2e-access-secret-'.padEnd(40, 'x');
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ?? 'e2e-refresh-secret-'.padEnd(40, 'x');
    process.env.NODE_ENV = 'test';

    const migrator = new DataSource({
      type: 'postgres',
      host: DB.host,
      port: DB.port,
      database: ephemeralDb,
      username: DB.user,
      password: DB.password,
      entities,
      migrations: ['src/database/migrations/*.ts'],
    });
    await migrator.initialize();
    await migrator.runMigrations();
    await migrator.destroy();

    // This suite signs in more often than the 5-a-minute login limit allows.
    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StorageService)
      .useValue({
        createDownloadUrl: jest.fn().mockResolvedValue('https://s3.mock/x'),
      })
      .overrideProvider(NotificationsService)
      .useValue({ sendEmail: jest.fn(), pushToUser: jest.fn() })
      .compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    ds = app.get(DataSource);

    await ds.getRepository(Admin).save({
      name: 'Boss',
      email: BOSS.email,
      password_hash: await argon2.hash(BOSS.password),
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
    });
    boss = ((await login(BOSS).expect(200)).body as Tokens).access_token;

    const created = await send(boss, 'post', '/admin/staff', {
      name: 'Staff One',
      ...STAFF,
    }).expect(201);
    staffId = (created.body as { id: string }).id;
    expect(created.body).not.toHaveProperty('password_hash');

    const client = await ds.getRepository(User).save({
      name: 'Some Client',
      email: 'client@example.com',
      password_hash: await argon2.hash('Client@12345'),
      phone: '9876500001',
      user_type: UserType.GENERAL,
      status: UserStatus.ACTIVE,
    });
    const doc = await ds.getRepository(Document).save({
      user_id: client.id,
      category: DocumentCategory.GENERAL,
      original_filename: 'pan.pdf',
      s3_key: 'docs/x/pan.pdf',
      file_type: DocumentFileType.PDF,
      file_size_bytes: '10',
      status: DocumentStatus.RECEIVED,
    });
    docId = doc.id;
  });

  afterAll(async () => {
    if (app) await app.close();
    const maintenance = new Client({ ...DB, database: 'postgres' });
    await maintenance.connect();
    await maintenance.query(
      `DROP DATABASE IF EXISTS "${ephemeralDb}" WITH (FORCE)`,
    );
    await maintenance.end();
  });

  it('a new staff member can reach nothing but their own profile', async () => {
    const { access_token: t } = await staffLogin();
    await get(t, '/admin/me').expect(200);
    await get(t, '/admin/users').expect(403);
    await get(t, '/admin/documents').expect(403);
    await get(t, '/admin/tickets').expect(403);
    await get(t, '/whatsapp-chats/conversations').expect(403);
    await get(t, '/admin/rent-agreements').expect(403);
    await get(t, '/admin/audit-logs').expect(403);
    // Shared client/admin route: no document of any client without access
    await get(t, `/documents/${docId}/download-url`).expect(403);
    // Staff page is for the super admin only
    await get(t, '/admin/staff').expect(403);
    await send(t, 'put', `/admin/staff/${staffId}/permissions`, {
      permission_keys: ['manage_clients'],
    }).expect(403);

    const stats = (await get(t, '/admin/dashboard/stats').expect(200)).body as {
      total_clients: number | null;
      recent_activity: unknown[];
    };
    expect(stats.total_clients).toBeNull();
    expect(stats.recent_activity).toEqual([]);
  });

  it('"can view" reads but cannot change; access changes hit a live token', async () => {
    const { access_token: t } = await staffLogin();
    await get(t, '/admin/users').expect(403);

    // Granted while signed in: the very same token now works
    await setAccess(['view_clients', 'view_documents']);
    await get(t, '/admin/users').expect(200);
    await get(t, `/documents/${docId}/download-url`).expect(200);
    await send(t, 'post', '/admin/users', {}).expect(403);
    await send(t, 'patch', `/admin/documents/${docId}/processed`).expect(403);
    await get(t, '/admin/tickets').expect(403);

    await setAccess(['manage_documents']);
    await send(t, 'patch', `/admin/documents/${docId}/processed`).expect(200);
    // …and taken away again, still on the same token
    await get(t, '/admin/users').expect(403);
  });

  it('saving Reports also saves the client list it depends on', async () => {
    const saved = (await setAccess(['manage_reports'])).body as {
      permission_key: string;
    }[];
    expect(saved.map((p) => p.permission_key).sort()).toEqual([
      'manage_reports',
      'view_clients',
      'view_reports',
    ]);
    await send(boss, 'put', `/admin/staff/${staffId}/permissions`, {
      permission_keys: ['manage_staff'],
    }).expect(400);
  });

  it('deactivating signs the staff member out at once, everywhere', async () => {
    await setAccess(['view_clients']);
    const tokens = await staffLogin();
    await get(tokens.access_token, '/admin/users').expect(200);

    await send(boss, 'delete', `/admin/staff/${staffId}`).expect(200);

    await get(tokens.access_token, '/admin/users').expect(401);
    await get(tokens.access_token, '/admin/me').expect(401);
    await api()
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: tokens.refresh_token })
      .expect(401);
    await login(STAFF).expect(403);

    // Reactivated: old tokens stay dead, a fresh sign-in works
    await send(boss, 'patch', `/admin/staff/${staffId}`, {
      status: 'active',
    }).expect(200);
    await get(tokens.access_token, '/admin/users').expect(401);
    await api()
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: tokens.refresh_token })
      .expect(401);
    await new Promise((r) => setTimeout(r, 1100)); // token iat is in whole seconds
    const fresh = await staffLogin();
    await get(fresh.access_token, '/admin/users').expect(200);
  });

  it('a password reset ends old sessions and the old password', async () => {
    const tokens = await staffLogin();
    await send(boss, 'post', `/admin/staff/${staffId}/password`, {
      password: 'short',
    }).expect(400);
    await send(boss, 'post', `/admin/staff/${staffId}/password`, {
      password: 'NewPass@12345',
    }).expect(200);

    await get(tokens.access_token, '/admin/users').expect(401);
    await login(STAFF).expect(401);
    await new Promise((r) => setTimeout(r, 1100));
    const fresh = (
      await login({ email: STAFF.email, password: 'NewPass@12345' }).expect(200)
    ).body as Tokens;
    await get(fresh.access_token, '/admin/users').expect(200);
  });

  it('the super admin cannot be locked out through the Staff page', async () => {
    const bossId = (
      await ds.getRepository(Admin).findOneByOrFail({ email: BOSS.email })
    ).id;
    await send(boss, 'delete', `/admin/staff/${bossId}`).expect(403);
    await send(boss, 'post', `/admin/staff/${bossId}/password`, {
      password: 'Whatever@123',
    }).expect(403);
    await send(boss, 'post', '/admin/staff', {
      name: 'Second Boss',
      email: 'boss2@example.com',
      password: 'Boss2@12345',
      role: 'super_admin',
    }).expect(400);
  });

  it('the migration carries old permissions over to the new ones', async () => {
    await ds.query(`DELETE FROM permissions WHERE admin_id = $1`, [staffId]);
    await ds.query(
      `INSERT INTO permissions (admin_id, permission_key, granted) VALUES
        ($1, 'view_clients', true), ($1, 'upload_reports', true),
        ($1, 'manage_staff', true), ($1, 'view_documents', false)`,
      [staffId],
    );
    const runner = ds.createQueryRunner();
    await new StaffAccessControl1800000000009().up(runner);
    await runner.release();

    const rows: { permission_key: string }[] = await ds.query(
      `SELECT permission_key FROM permissions
        WHERE admin_id = $1 AND granted ORDER BY 1`,
      [staffId],
    );
    expect(rows.map((r) => r.permission_key)).toEqual([
      'manage_clients',
      'manage_rent_agreements',
      'manage_reports',
      'manage_tickets',
      'manage_whatsapp',
      'view_clients',
      'view_reports',
    ]);
  });
});

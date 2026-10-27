import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { User, entities } from '../src/entities';
import { UserStatus, UserType } from '../src/common/enums';
import { AccountDeletionService } from '../src/account-deletion/account-deletion.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { StorageService } from '../src/storage/storage.service';

// Account deletion against a real PostgreSQL (all migrations applied):
// request → locked → sign-in cancels → request again → erased after 30 days,
// with tax records kept. Runs only when E2E_ENABLED=true; S3 / email mocked.
const runFlow = process.env.E2E_ENABLED === 'true' ? describe : describe.skip;

const DB = {
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
};
const ephemeralDb = `ca_delete_e2e_${Date.now()}`;

const storageMock = {
  deleteObject: jest.fn().mockResolvedValue(undefined),
  createDownloadUrl: jest.fn().mockResolvedValue('https://s3.mock/x'),
};
const notificationsMock = {
  sendEmail: jest.fn().mockResolvedValue(true),
  pushToUser: jest.fn().mockResolvedValue(true),
};

const EMAIL = 'leaving@example.com';
const PASSWORD = 'Client@12345';
const DAY = 24 * 60 * 60 * 1000;

interface Tokens {
  access_token: string;
  refresh_token: string;
}

runFlow('Account deletion (e2e)', () => {
  let app: INestApplication<App>;
  let ds: DataSource;
  let userId: string;

  const api = () => request(app.getHttpServer());
  const login = () =>
    api()
      .post('/api/v1/auth/login/user')
      .send({ email: EMAIL, password: PASSWORD });
  const asUser = (token: string) => ({
    post: (url: string) =>
      api()
        .post(url)
        .set({ Authorization: `Bearer ${token}` }),
  });
  const row = () => ds.getRepository(User).findOneByOrFail({ id: userId });
  const count = async (sql: string) =>
    Number((await ds.query(sql, [userId]))[0].n);

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

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StorageService)
      .useValue(storageMock)
      .overrideProvider(NotificationsService)
      .useValue(notificationsMock)
      .compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    ds = app.get(DataSource);

    const user = await ds.getRepository(User).save({
      name: 'Leaving Client',
      email: EMAIL,
      password_hash: await argon2.hash(PASSWORD),
      phone: '9876500000',
      pan: 'ABCDE1234F',
      gstin: '24ABCDE1234F1Z5',
      user_type: UserType.BOTH,
      status: UserStatus.ACTIVE,
    });
    userId = user.id;
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

  it('rejects a wrong password', async () => {
    const token = ((await login().expect(200)).body as Tokens).access_token;
    await asUser(token)
      .post('/api/v1/me/delete-account')
      .send({ password: 'wrong' })
      .expect(403);
    expect((await row()).status).toBe(UserStatus.ACTIVE);
  });

  it('locks the account; signing in again cancels it', async () => {
    const tokens = (await login().expect(200)).body as Tokens;
    const me = asUser(tokens.access_token);
    await me
      .post('/api/v1/me/device-token')
      .send({ push_token: 'fcm-token-1', platform: 'android' })
      .expect(201);

    const res = await me
      .post('/api/v1/me/delete-account')
      .send({ password: PASSWORD })
      .expect(200);
    expect(
      new Date((res.body as { delete_after: string }).delete_after).getTime(),
    ).toBeGreaterThan(Date.now() + 29 * DAY);

    const locked = await row();
    expect(locked.status).toBe(UserStatus.INACTIVE);
    expect(locked.deletion_requested_at).not.toBeNull();
    expect(
      await count(`SELECT count(*) n FROM device_tokens WHERE user_id = $1`),
    ).toBe(0);
    // Old sessions are revoked
    await api()
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: tokens.refresh_token })
      .expect(401);
    expect(notificationsMock.sendEmail).toHaveBeenCalled();

    await login().expect(200);
    const reopened = await row();
    expect(reopened.status).toBe(UserStatus.ACTIVE);
    expect(reopened.deletion_requested_at).toBeNull();
  });

  it('erases login and personal details after 30 days, keeping tax records', async () => {
    const token = ((await login().expect(200)).body as Tokens).access_token;
    const me = asUser(token);
    await me
      .post('/api/v1/me/tickets')
      .send({ subject: 'Question', message: 'About my return' })
      .expect(201);
    await me
      .post('/api/v1/me/family-members')
      .send({ name: 'Sunita Patel', relation: 'spouse' })
      .expect(201);
    await me
      .post('/api/v1/me/delete-account')
      .send({ password: PASSWORD })
      .expect(200);

    const deletion = app.get(AccountDeletionService);
    // Not yet due
    expect(await deletion.eraseDue(new Date(Date.now() + 29 * DAY))).toBe(0);
    expect(await deletion.eraseDue(new Date(Date.now() + 31 * DAY))).toBe(1);

    const erased = await row();
    expect(erased.deleted_at).not.toBeNull();
    expect(erased.email).toBe(`deleted-${userId}@deleted.invalid`);
    expect(erased.phone).toBeNull();
    // Tax identity stays for the firm
    expect(erased.name).toBe('Leaving Client');
    expect(erased.pan).toBe('ABCDE1234F');
    expect(erased.gstin).toBe('24ABCDE1234F1Z5');
    expect(
      await count(`SELECT count(*) n FROM family_members WHERE user_id = $1`),
    ).toBe(1);
    // Support chats are gone
    expect(
      await count(`SELECT count(*) n FROM tickets WHERE user_id = $1`),
    ).toBe(0);

    // The old login no longer works, and the email is free for a new account
    await login().expect(401);
  });
});

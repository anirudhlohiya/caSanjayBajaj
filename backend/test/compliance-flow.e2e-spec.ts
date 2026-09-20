import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { Admin, User, entities } from '../src/entities';
import {
  AdminRole,
  AdminStatus,
  ComplianceCategory,
  GstFilingFrequency,
  TaskStatus,
  UserStatus,
  UserType,
} from '../src/common/enums';
import { NotificationsService } from '../src/notifications/notifications.service';
import { StorageService } from '../src/storage/storage.service';

// Full-flow e2e (docs/13 §13). Runs only when E2E_ENABLED=true so CI without a
// reachable PostgreSQL keeps passing. It creates an ephemeral database, runs
// all migrations, then exercises the whole automation loop over real HTTP:
// admin creates a period → tasks auto-generate → client declares nil → admin
// confirms → client uploads evidence (task → UPLOADED) → report request →
// fulfill → emailed share link persisted. S3/SES/web-push are mocked; nothing
// leaves the machine.
const runFlow = process.env.E2E_ENABLED === 'true' ? describe : describe.skip;

const DB = {
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
};
const ephemeralDb = `ca_gst_e2e_${Date.now()}`;

const storageMock = {
  createUploadUrl: jest
    .fn()
    .mockImplementation(
      (prefix: string, userId: string, periodCode: string, filename: string) =>
        Promise.resolve({
          uploadUrl: 'https://s3.mock-bucket.test/upload',
          s3Key: `${prefix}/${userId}/${periodCode}/${filename}`,
        }),
    ),
  createDownloadUrl: jest
    .fn()
    .mockResolvedValue('https://s3.mock-bucket.test/download'),
  createAttachmentDownloadUrl: jest
    .fn()
    .mockResolvedValue('https://s3.mock-bucket.test/attachment'),
};
const notificationsMock = {
  sendEmail: jest.fn().mockResolvedValue(true),
  sendPush: jest.fn().mockResolvedValue(true),
};

interface TokenPair {
  access_token: string;
}

interface Task {
  id: string;
  category: string;
  status: string;
  nil_declared_at?: string;
}

runFlow('GST automation: full compliance flow (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let clientToken: string;
  let clientId: string;
  let periodId: string;
  let gstr1TaskId: string;
  let requestId: string;
  let reportId: string;

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (url: string) => api().get(url).set(bearer(token)),
    post: (url: string) => api().post(url).set(bearer(token)),
    patch: (url: string) => api().patch(url).set(bearer(token)),
  });
  const admin = () => as(adminToken);
  const client = () => as(clientToken);

  async function setup() {
    // 1. Ephemeral database, migrations applied (docs/13 §13 §2).
    const maintenance = new Client({ ...DB, database: 'postgres' });
    await maintenance.connect();
    await maintenance.query(`DROP DATABASE IF EXISTS "${ephemeralDb}"`);
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
      synchronize: false,
    });
    await migrator.initialize();
    await migrator.runMigrations();
    await migrator.destroy();

    // 2. Boot the real app with S3 + notification providers replaced by mocks.
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

    // 3. Seed a super admin and one monthly client (argon2 like real signups).
    const ds = app.get(DataSource);
    const adminHash = await argon2.hash('Admin@12345');
    const clientHash = await argon2.hash('Client@12345');

    const adminRow = await ds.getRepository(Admin).save({
      name: 'E2E Super Admin',
      email: 'admin-e2e@snbajaj.com',
      password_hash: adminHash,
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
    });
    const userRow = await ds.getRepository(User).save({
      name: 'E2E Client',
      email: 'client-e2e@example.com',
      password_hash: clientHash,
      phone: '9876543210',
      gstin: '22AAAAA0000A1Z5',
      user_type: UserType.GST,
      status: UserStatus.ACTIVE,
      gst_filing_frequency: GstFilingFrequency.MONTHLY,
    });
    clientId = userRow.id;

    // 4. Real logins (docs/13 §6.5 auth).
    const adminLogin = await api()
      .post('/api/v1/auth/login/admin')
      .send({ email: adminRow.email, password: 'Admin@12345' })
      .expect(200);
    adminToken = (adminLogin.body as TokenPair).access_token;
    const clientLogin = await api()
      .post('/api/v1/auth/login/user')
      .send({ email: userRow.email, password: 'Client@12345' })
      .expect(200);
    clientToken = (clientLogin.body as TokenPair).access_token;
  }

  beforeAll(async () => {
    try {
      await setup();
    } catch (err) {
      const detail =
        err instanceof AggregateError
          ? (err.errors ?? [])
              .map((e) => String((e as { stack?: unknown })?.stack ?? e))
              .join('\n---\n')
          : String((err as Error)?.stack ?? err);

      console.error('E2E SETUP FAILED:\n' + detail);
      throw err;
    }
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

  it('admin creates a period and the task set auto-generates', async () => {
    const created = await admin()
      .post('/api/v1/periods')
      .send({
        period_label: 'October 2026',
        period_code: '2026-10',
        due_date: '2026-10-11',
      })
      .expect(201);
    const period = created.body as { id: string; schedule?: unknown };
    periodId = period.id;
    expect(period.schedule).toBeDefined();

    const before = await admin()
      .get(`/api/v1/compliance-tasks/admin/client/${clientId}`)
      .query({ periodId })
      .expect(200);
    expect(before.body as unknown[]).toHaveLength(0);

    await admin()
      .post(`/api/v1/compliance-tasks/admin/client/${clientId}/auto-generate`)
      .send({ periodId })
      .expect(201);

    const tasks = await admin()
      .get(`/api/v1/compliance-tasks/admin/client/${clientId}`)
      .query({ periodId })
      .expect(200);
    const categories = (tasks.body as Task[]).map((t) => t.category);
    expect(categories).toEqual(
      expect.arrayContaining([
        ComplianceCategory.GSTR_1 as string,
        ComplianceCategory.GSTR_3B as string,
        ComplianceCategory.GST_PAYMENT as string,
      ]),
    );

    gstr1TaskId = (tasks.body as Task[]).find(
      (t) => t.category === (ComplianceCategory.GSTR_1 as string),
    )!.id;
  });

  it('client declares nil (gstr_1) and admin confirms it (audited)', async () => {
    const nil = await client()
      .post(`/api/v1/compliance-tasks/${gstr1TaskId}/nil`)
      .expect(201);
    const nilBody = nil.body as Task;
    expect(nilBody.status).toBe(TaskStatus.NIL_DECLARED);
    expect(nilBody.nil_declared_at).toBeDefined();

    await admin()
      .patch(`/api/v1/compliance-tasks/admin/${gstr1TaskId}/nil-confirm`)
      .expect(200);

    const tasks = await client()
      .get('/api/v1/compliance-tasks')
      .query({ periodId })
      .expect(200);
    const gstr1 = (tasks.body as Task[]).find((t) => t.id === gstr1TaskId);
    expect(gstr1?.status).toBe(TaskStatus.COMPLETED);

    // docs/13 §11.7: every privileged action writes an audit row.
    const ds = app.get(DataSource);
    const auditRow = await ds
      .getRepository('AuditLog')
      .findOne({ where: { action: 'nil.confirmed' } });
    expect(auditRow).not.toBeNull();
  });

  it('confirming a document upload advances the next task to UPLOADED', async () => {
    const upload = await client()
      .post('/api/v1/documents/upload-url')
      .send({
        filing_period_id: periodId,
        filename: 'oct-2026-invoices.pdf',
        contentType: 'application/pdf',
        file_type: 'pdf',
        file_size_bytes: 2048,
      })
      .expect(201);
    const documentId = (upload.body as { document_id: string }).document_id;

    await client()
      .post(`/api/v1/documents/${documentId}/confirm`)
      .send({ file_size_bytes: 2048 })
      .expect(201);

    const tasks = await client()
      .get('/api/v1/compliance-tasks')
      .query({ periodId })
      .expect(200);
    const gstr3b = (tasks.body as Task[]).find(
      (t) => t.category === (ComplianceCategory.GSTR_3B as string),
    );
    expect(gstr3b?.status).toBe(TaskStatus.UPLOADED);
  });

  it('client requests a report, admin fulfils it, share link persists', async () => {
    const created = await client()
      .post('/api/v1/me/report-requests')
      .send({ filing_period_id: periodId })
      .expect(201);
    const requestRow = created.body as { id: string; status: string };
    requestId = requestRow.id;
    expect(requestRow.status).toBe('pending');

    const fulfilled = await admin()
      .post(`/api/v1/admin/report-requests/${requestId}/fulfill`)
      .send({
        report_type: 'gstr_1',
        filename: 'oct-2026-gstr1.pdf',
        contentType: 'application/pdf',
        file_size_bytes: 4096,
      })
      .expect(201);
    reportId = (fulfilled.body as { report_id: string }).report_id;

    await admin().post(`/api/v1/admin/reports/${reportId}/confirm`).expect(201);

    const mine = await client().get('/api/v1/me/report-requests').expect(200);
    const row = (
      mine.body as {
        items: Array<{
          status: string;
          fulfilled_report?: { id: string; report_type: string };
        }>;
      }
    ).items[0];
    expect(row.status).toBe('fulfilled');
    expect(row.fulfilled_report).toEqual(
      expect.objectContaining({ id: reportId, report_type: 'gstr_1' }),
    );

    // docs/13 §3.8: confirming persists an emailed share link; the raw 30-day
    // token is only ever handed to the recipient (we store its sha256).
    const ds = app.get(DataSource);
    const link = await ds.query<Array<{ token_hash: string }>>(
      `SELECT token_hash FROM report_share_links WHERE report_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [reportId],
    );
    expect(link).toHaveLength(1);
    expect(link[0].token_hash).toMatch(/^[a-f0-9]{64}$/);

    const dl = await client()
      .get(`/api/v1/me/reports/${reportId}/download-url`)
      .expect(200);
    expect((dl.body as { download_url: string }).download_url).toBe(
      'https://s3.mock-bucket.test/download',
    );
  });
});

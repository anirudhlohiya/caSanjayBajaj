import { Repository } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CertType } from '../common/enums';
import { ClientCertificate, User } from '../entities';
import { StorageService } from '../storage/storage.service';
import { CreateCertificateUploadUrlDto } from './dto/certificate.dto';
import { CertificatesService } from './certificates.service';

describe('CertificatesService', () => {
  let service: CertificatesService;
  let saved: ClientCertificate[];
  let findMock: jest.Mock;
  let findOneMock: jest.Mock;
  let saveMock: jest.Mock;
  let createMock: jest.Mock;
  let removeMock: jest.Mock;

  const certUploadUrlMock = jest.fn().mockResolvedValue({
    uploadUrl: 'https://s3.example/upload',
    s3Key: 'certificates/u1/cert.pdf',
  });
  const certDownloadUrlMock = jest
    .fn()
    .mockResolvedValue('https://s3.example/download');
  const storage = {
    createCertificateUploadUrl: certUploadUrlMock,
    createDownloadUrl: certDownloadUrlMock,
  } as unknown as StorageService;
  const auditLogMock = jest.fn().mockResolvedValue({});
  const audit = {
    log: auditLogMock,
  } as unknown as AuditService;

  const usersRepo = {
    findOneBy: jest.fn(),
    find: jest.fn(),
  } as unknown as Repository<User>;
  const certsRepo = {} as unknown as Repository<ClientCertificate>;

  const userAuth: AuthUser = {
    type: 'user',
    sub: 'u1',
    email: 'client@snbajaj.com',
    role: undefined,
    permissions: [],
  };
  const otherUserAuth: AuthUser = {
    type: 'user',
    sub: 'u2',
    email: 'other@snbajaj.com',
    role: undefined,
    permissions: [],
  };

  const certRow = (overrides: Partial<ClientCertificate> = {}) =>
    ({
      id: 'c1',
      user_id: 'u1',
      cert_type: CertType.GST_CERT,
      s3_key: 'certificates/u1/cert.pdf',
      original_filename: 'gst_cert.pdf',
      uploaded_at: new Date('2026-09-01T08:00:00Z'),
      ...overrides,
    }) as ClientCertificate;

  const isOperator = (
    value: unknown,
  ): value is { _type: string; _value: unknown } =>
    typeof value === 'object' &&
    value !== null &&
    '_type' in value &&
    typeof value._type === 'string';

  const compareWhere = (actual: unknown, value: unknown): boolean => {
    if (isOperator(value)) {
      const { _type: operator, _value: inner } = value;
      if (operator === 'not') return !compareWhere(actual, inner);
      if (operator === 'isNull') return actual === null;
      if (operator === 'isNotNull') return actual !== null;
      return true;
    }
    return actual === value;
  };

  const matchesWhere = (
    row: ClientCertificate,
    where: Record<string, unknown>,
  ): boolean =>
    Object.entries(where).every(([key, value]) =>
      compareWhere(row[key as keyof ClientCertificate], value),
    );

  beforeEach(() => {
    saved = [];
    findMock = jest
      .fn()
      .mockImplementation((opts?: { where?: Record<string, unknown> }) => {
        let rows = saved;
        if (opts?.where) {
          rows = rows.filter((r) => matchesWhere(r, opts.where!));
        }
        return Promise.resolve(rows);
      });
    findOneMock = jest
      .fn()
      .mockImplementation((opts: { where?: Record<string, unknown> }) =>
        Promise.resolve(
          saved.find(
            (r) =>
              r.id === (opts?.where?.id as string) ||
              r.id === (opts?.where?.id as string),
          ) ?? null,
        ),
      );
    saveMock = jest
      .fn()
      .mockImplementation((rows: ClientCertificate | ClientCertificate[]) => {
        const list = Array.isArray(rows) ? rows : [rows];
        const result = list.map((r) => {
          if (!r.id) r.id = `c${saved.length + 1}`;
          saved.push(r);
          return r;
        });
        return Promise.resolve(Array.isArray(rows) ? result : result[0]);
      });
    createMock = jest.fn((v: object) => v);
    removeMock = jest
      .fn()
      .mockImplementation((rows: ClientCertificate | ClientCertificate[]) => {
        const list = Array.isArray(rows) ? rows : [rows];
        list.forEach((r) => {
          saved = saved.filter((x) => x.id !== r.id);
        });
        return Promise.resolve(Array.isArray(rows) ? list : list[0]);
      });
    Object.assign(certsRepo, {
      find: findMock,
      findOne: findOneMock,
      save: saveMock,
      create: createMock,
      remove: removeMock,
    });

    service = new CertificatesService(certsRepo, usersRepo, storage, audit);
  });

  afterEach(() => jest.clearAllMocks());

  describe('listForUser', () => {
    it('returns only confirmed certificates, newest first', async () => {
      saved = [certRow({ id: 'c2', uploaded_at: null }), certRow({ id: 'c1' })];
      const rows = await service.listForUser('u1');
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('c1');
    });
  });

  describe('requestUploadUrl', () => {
    it('creates a pending row and returns the presigned URL', async () => {
      (usersRepo.findOneBy as jest.Mock).mockResolvedValue({ id: 'u1' });
      const dto: CreateCertificateUploadUrlDto = {
        cert_type: CertType.GST_CERT,
        filename: 'gst_cert.pdf',
        contentType: 'application/pdf',
      };

      const res = await service.requestUploadUrl('u1', dto);

      expect(res).toMatchObject({
        upload_url: 'https://s3.example/upload',
        expires_in: 300,
      });
      expect(res.certificate_id).toEqual(expect.any(String));
      expect(saved).toHaveLength(1);
      expect(saved[0].uploaded_at).toBeNull();
      expect(saved[0].original_filename).toBe('gst_cert.pdf');
      expect(certUploadUrlMock).toHaveBeenCalledWith(
        'u1',
        'gst_cert.pdf',
        'application/pdf',
      );
    });

    it('throws 404 when the target user does not exist', async () => {
      (usersRepo.findOneBy as jest.Mock).mockResolvedValue(null);
      await expect(
        service.requestUploadUrl(
          'missing',
          {} as CreateCertificateUploadUrlDto,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('confirm', () => {
    it('finalizes the upload, replaces prior same-type certs, logs audit', async () => {
      saved = [
        certRow({ id: 'old', uploaded_at: new Date() }),
        certRow({ id: 'new', uploaded_at: null }),
      ];

      const res = await service.confirm(userAuth, 'new');

      expect(res.uploaded_at).not.toBeNull();
      expect(saved.some((r) => r.id === 'old')).toBe(false);
      expect(saved.some((r) => r.id === 'new')).toBe(true);
      expect(auditLogMock).toHaveBeenCalledWith(
        'u1',
        'certificate.uploaded',
        expect.objectContaining({ client_certificate_id: 'new' }),
        { user_id: 'u1' },
      );
    });

    it('throws 404 for a missing certificate', async () => {
      await expect(service.confirm(userAuth, 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('downloadUrl', () => {
    it('returns a signed URL for the owner', async () => {
      saved = [certRow()];
      const res = await service.downloadUrl(userAuth, 'c1');
      expect(res.download_url).toBe('https://s3.example/download');
    });

    it('forbids access to another user certificate', async () => {
      saved = [certRow()];
      await expect(
        service.downloadUrl(otherUserAuth, 'c1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws 404 for an unconfirmed certificate', async () => {
      saved = [certRow({ uploaded_at: null })];
      await expect(service.downloadUrl(userAuth, 'c1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});

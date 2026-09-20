import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { ReportRequestStatus, ReportType } from '../common/enums';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { ReportRequest } from '../entities/report-request.entity';
import { ReportsService } from '../reports/reports.service';
import { FulfillReportRequestDto } from './dto/report-request.dto';
import { ReportRequestsService } from './report-requests.service';

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
const adminAuth: AuthUser = {
  type: 'admin',
  sub: 'a1',
  email: 'admin@snbajaj.com',
  role: 'super_admin',
  permissions: ['upload_reports'],
};

const makeRequest = (overrides: Partial<ReportRequest> = {}): ReportRequest =>
  ({
    id: 'req1',
    user_id: 'u1',
    filing_period_id: 'p1',
    status: ReportRequestStatus.PENDING,
    fulfilled_report_id: null,
    fulfilled_at: null,
    ...overrides,
  }) as ReportRequest;

const period = { id: 'p1', period_code: '2026-10' } as GstFilingPeriod;

describe('ReportRequestsService', () => {
  let service: ReportRequestsService;
  let saved: ReportRequest[];
  let qb: Record<string, jest.Mock>;
  let requestsRepo: {
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let periodsRepo: { findOneBy: jest.Mock };
  let reportsService: { upload: jest.Mock };
  let audit: { log: jest.Mock };

  beforeEach(() => {
    saved = [];
    qb = {};
    requestsRepo = {
      findOne: jest
        .fn()
        .mockImplementation((opts: { where?: Record<string, unknown> }) => {
          const rows = saved.filter((r) =>
            Object.entries(opts?.where ?? {}).every(
              ([k, v]) => r[k as keyof ReportRequest] === v,
            ),
          );
          return Promise.resolve(rows[0] ?? null);
        }),
      findOneBy: jest
        .fn()
        .mockImplementation((q: { id: string }) =>
          Promise.resolve(saved.find((r) => r.id === q.id) ?? null),
        ),
      save: jest.fn((r: ReportRequest) => {
        const row = saved.find((x) => x.id === r.id) ?? r;
        if (!saved.includes(row)) saved.push(row);
        return Promise.resolve(row);
      }),
      create: jest.fn((v: object) => v),
      createQueryBuilder: jest.fn(() => qb as never),
    };
    periodsRepo = { findOneBy: jest.fn().mockResolvedValue(period) };
    reportsService = {
      upload: jest
        .fn()
        .mockResolvedValue({ report_id: 'r1', upload_url: 'https://s3/up' }),
    };
    audit = { log: jest.fn().mockResolvedValue({}) };

    service = new ReportRequestsService(
      requestsRepo as unknown as Repository<ReportRequest>,
      periodsRepo as unknown as Repository<GstFilingPeriod>,
      reportsService as unknown as ReportsService,
      audit as unknown as AuditService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates a pending request for the client', async () => {
      const res = await service.create(userAuth, { filing_period_id: 'p1' });

      expect(res.status).toBe(ReportRequestStatus.PENDING);
      expect(saved).toHaveLength(1);
      expect(saved[0].user_id).toBe('u1');
      expect(saved[0].filing_period_id).toBe('p1');
    });

    it('throws 404 when the filing period is unknown', async () => {
      periodsRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(userAuth, { filing_period_id: 'nope' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a duplicate pending request for the same period', async () => {
      saved = [makeRequest()];
      await expect(
        service.create(userAuth, { filing_period_id: 'p1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('listMine', () => {
    it('returns only the current user requests with period + fulfilled report', async () => {
      qb.leftJoinAndSelect = jest.fn(() => qb);
      qb.where = jest.fn(() => qb);
      qb.andWhere = jest.fn(() => qb);
      qb.orderBy = jest.fn(() => qb);
      qb.skip = jest.fn(() => qb);
      qb.take = jest.fn(() => qb);
      qb.getManyAndCount = jest.fn().mockResolvedValue([[makeRequest()], 1]);

      const res = await service.listMine(userAuth, {});
      expect(res.total).toBe(1);
      expect(qb.where).toHaveBeenCalledWith('request.user_id = :uid', {
        uid: 'u1',
      });
      expect(qb.leftJoinAndSelect).toHaveBeenCalledTimes(2);
    });
  });

  describe('adminList', () => {
    it('returns all requests, joining user and period', async () => {
      qb.leftJoinAndSelect = jest.fn(() => qb);
      qb.where = jest.fn(() => qb);
      qb.andWhere = jest.fn(() => qb);
      qb.orderBy = jest.fn(() => qb);
      qb.skip = jest.fn(() => qb);
      qb.take = jest.fn(() => qb);
      qb.getManyAndCount = jest.fn().mockResolvedValue([[makeRequest()], 1]);

      const res = await service.adminList({});
      expect(res.total).toBe(1);
      expect(qb.leftJoinAndSelect).toHaveBeenCalledTimes(2);
    });
  });

  describe('fulfill', () => {
    it('creates the report row, marks the request fulfilled, and audits', async () => {
      saved = [makeRequest()];

      const res = await service.fulfill(adminAuth, 'req1', {
        report_type: ReportType.GSTR_3B,
        filename: 'gstr3b.pdf',
        contentType: 'application/pdf',
        file_size_bytes: 1024,
      });

      expect(res).toMatchObject({
        report_id: 'r1',
        upload_url: 'https://s3/up',
        expires_in: 300,
      });
      const updated = saved[0];
      expect(updated.status).toBe(ReportRequestStatus.FULFILLED);
      expect(updated.fulfilled_report_id).toBe('r1');
      expect(updated.fulfilled_at).not.toBeNull();
      expect(reportsService.upload).toHaveBeenCalledWith(
        adminAuth,
        expect.objectContaining({
          user_id: 'u1',
          filing_period_id: 'p1',
          report_type: ReportType.GSTR_3B,
          filename: 'gstr3b.pdf',
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'a1',
        'request.fulfilled',
        expect.objectContaining({ report_request_id: 'req1', report_id: 'r1' }),
        { user_id: 'u1' },
      );
    });

    it('throws 404 for an unknown request', async () => {
      await expect(
        service.fulfill(adminAuth, 'missing', {} as FulfillReportRequestDto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 400 when the request is not pending', async () => {
      saved = [makeRequest({ status: ReportRequestStatus.FULFILLED })];
      await expect(
        service.fulfill(adminAuth, 'req1', {} as FulfillReportRequestDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('forbids a client fulfilling another client request', async () => {
      saved = [makeRequest()];
      await expect(
        service.fulfill(otherUserAuth, 'req1', {} as FulfillReportRequestDto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportRequestsService } from './report-requests.service';
import { ReportRequest } from '../entities/report-request.entity';
import { ReportRequestStatus, ReportType } from '../common/enums';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { ReportsService } from '../reports/reports.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { FulfillReportRequestDto } from './dto/report-request.dto';

describe('ReportRequestsService', () => {
  let service: ReportRequestsService;
  let requestsRepo: any;
  let periodsRepo: any;
  let reportsService: any;
  let auditService: any;

  const mockAuthUser: AuthUser = {
    sub: 'user-1',
    email: 'test@example.com',
    type: 'user',
  };
  const mockAdminUser: AuthUser = {
    sub: 'admin-1',
    email: 'admin@example.com',
    type: 'admin',
  };

  beforeEach(async () => {
    requestsRepo = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest
        .fn()
        .mockImplementation((entity) =>
          Promise.resolve({ id: 'request-1', ...entity }),
        ),
      createQueryBuilder: jest.fn(),
    };
    periodsRepo = {
      findOneBy: jest.fn(),
    };
    reportsService = {
      upload: jest.fn(),
    };
    auditService = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportRequestsService,
        { provide: getRepositoryToken(ReportRequest), useValue: requestsRepo },
        { provide: getRepositoryToken(GstFilingPeriod), useValue: periodsRepo },
        { provide: ReportsService, useValue: reportsService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<ReportRequestsService>(ReportRequestsService);
  });

  describe('create', () => {
    it('creates a pending request', async () => {
      periodsRepo.findOneBy.mockResolvedValue({ id: 'period-1' });
      requestsRepo.findOne.mockResolvedValue(null);

      const result = await service.create(mockAuthUser, {
        filing_period_id: 'period-1',
      });

      expect(result).toMatchObject({
        user_id: 'user-1',
        filing_period_id: 'period-1',
        status: ReportRequestStatus.PENDING,
      });
      expect(requestsRepo.save).toHaveBeenCalled();
    });

    it('throws BadRequest if request already pending', async () => {
      periodsRepo.findOneBy.mockResolvedValue({ id: 'period-1' });
      requestsRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create(mockAuthUser, { filing_period_id: 'period-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('fulfill', () => {
    const fulfillDto: FulfillReportRequestDto = {
      report_type: ReportType.GSTR_1,
      filename: 'test.pdf',
      contentType: 'application/pdf',
      file_size_bytes: 100,
    };

    it('fulfills pending request and logs audit', async () => {
      requestsRepo.findOne.mockResolvedValue({
        id: 'request-1',
        status: ReportRequestStatus.PENDING,
        user_id: 'user-1',
        filing_period_id: 'period-1',
      });
      periodsRepo.findOneBy.mockResolvedValue({ id: 'period-1' });
      reportsService.upload.mockResolvedValue({
        report_id: 'report-1',
        upload_url: 'http://upload',
      });

      const result = await service.fulfill(
        mockAdminUser,
        'request-1',
        fulfillDto,
      );

      expect(result).toEqual({
        report_id: 'report-1',
        upload_url: 'http://upload',
        expires_in: 300,
      });
      expect(requestsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ReportRequestStatus.FULFILLED,
          fulfilled_report_id: 'report-1',
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        'admin-1',
        'request.fulfilled',
        expect.any(Object),
        expect.any(Object),
      );
    });
  });
});

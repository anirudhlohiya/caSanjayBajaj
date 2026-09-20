import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { SchedulingService } from '../schedule/scheduling.service';
import { ComplianceTasksService } from '../compliance-tasks/compliance-tasks.service';
import { PeriodsService } from './periods.service';

describe('PeriodsService', () => {
  let service: PeriodsService;
  let createMock: jest.Mock;
  const saved: GstFilingPeriod[] = [];

  const periodsRepo = {} as unknown as Repository<GstFilingPeriod>;
  const config = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'autoCreatePeriods.prefetch') return 2;
      if (key === 'nodeEnv') return 'test';
      return undefined;
    }),
  } as unknown as ConfigService;
  const tasks = {
    generateAllForPeriod: jest.fn().mockResolvedValue(3),
  } as unknown as ComplianceTasksService;
  const audit = {
    log: jest.fn().mockResolvedValue({}),
  };

  beforeEach(() => {
    saved.length = 0;
    jest.clearAllMocks();

    createMock = jest.fn((v: object) => {
      saved.push(v as GstFilingPeriod);
      return v;
    });
    Object.assign(periodsRepo, {
      findOneBy: jest.fn().mockResolvedValue(null),
      create: createMock,
      save: jest.fn((v: GstFilingPeriod) => Promise.resolve(v)),
      find: jest.fn().mockResolvedValue([]),
    });

    service = new PeriodsService(
      periodsRepo,
      new SchedulingService(),
      tasks,
      config,
      audit as unknown as AuditService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('fills a default schedule when none is supplied', async () => {
      await service.create({
        period_label: 'October 2026',
        period_code: '2026-10',
        due_date: '2026-10-11',
        is_open: true,
      });

      expect(createMock).toHaveBeenCalledTimes(1);
      const created = (createMock.mock.calls as Array<[GstFilingPeriod]>)[0][0];
      expect(created.schedule).toBeDefined();
      expect(created.schedule!.gstr1.due).toBe('2026-10-11');
    });

    it('rejects an invalid supplied schedule', async () => {
      await expect(
        service.create({
          period_label: 'October 2026',
          period_code: '2026-10',
          due_date: '2026-10-11',
          schedule: {
            gstr1: { due: '2026-10-11', reminders: ['2026-11-05'] },
          } as never,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a duplicate period code', async () => {
      (periodsRepo.findOneBy as jest.Mock).mockResolvedValue({
        id: 'p1',
      });
      await expect(
        service.create({
          period_label: 'October 2026',
          period_code: '2026-10',
          due_date: '2026-10-11',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('ensurePeriods', () => {
    it('creates the current month plus the prefetch count with default schedules', async () => {
      const now = new Date();
      const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      await service.ensurePeriods();

      expect(createMock).toHaveBeenCalledTimes(3);
      const codes = (createMock.mock.calls as Array<[GstFilingPeriod]>).map(
        ([p]) => p.period_code,
      );
      expect(codes[0]).toBe(current);
      expect(codes).toHaveLength(3);
      for (const [p] of createMock.mock.calls as Array<[GstFilingPeriod]>) {
        expect(p.schedule).toBeDefined();
        expect(p.due_date).toBe(p.schedule!.gstr1.due);
        expect(p.is_open).toBe(true);
      }
    });

    it('leaves existing periods untouched', async () => {
      const now = new Date();
      const codes = [0, 1, 2].map((n) => {
        const d = new Date(now.getFullYear(), now.getMonth() + n, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      });

      // The current month already exists (e.g. admin-created with an override)
      (periodsRepo.findOneBy as jest.Mock).mockImplementation(
        ({ period_code }: { period_code: string }) =>
          period_code === codes[0]
            ? { id: 'p0', period_code, schedule: { custom: true } }
            : null,
      );

      await service.ensurePeriods();

      expect(createMock).toHaveBeenCalledTimes(2);
    });
  });

  const makeSchedule = (due: string, settling: string) => ({
    gstr1: { due, reminders: ['2026-10-08'] },
    gstr3b: { due, reminders: ['2026-10-18'] },
    iff: { due, reminders: ['2026-10-18'] },
    payment: { due, reminders: ['2026-10-20'] },
    quarterly: {
      gstr3b: {
        due: settling,
        reminders: ['2027-01-20'],
        quarter_label: 'Oct–Dec 2026',
      },
    },
  });

  const schedulePeriod = (schedule: Record<string, unknown>) => ({
    id: 'p1',
    period_code: '2026-10',
    period_label: 'October 2026',
    due_date: '2026-10-11',
    is_open: true,
    schedule,
  });

  describe('update', () => {
    it('rejects an invalid supplied schedule', async () => {
      (periodsRepo.findOneBy as jest.Mock).mockResolvedValue(
        schedulePeriod(makeSchedule('2026-10-11', '2027-01-22')),
      );

      await expect(
        service.update(
          'p1',
          { schedule: { gstr1: { due: '2026-10-11' } } } as never,
          'admin1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('audits when the schedule changes', async () => {
      (periodsRepo.findOneBy as jest.Mock).mockResolvedValue(
        schedulePeriod(makeSchedule('2026-10-11', '2027-01-22')),
      );

      await service.update(
        'p1',
        {
          due_date: '2026-10-21',
          schedule: makeSchedule('2026-10-21', '2027-01-28'),
        },
        'admin1',
      );

      expect(audit.log).toHaveBeenCalledWith(
        'admin1',
        'period.schedule_updated',
        expect.objectContaining({
          period_code: '2026-10',
          changed: expect.arrayContaining([
            'due_date',
            'schedule',
          ]) as unknown[],
        }),
        { period_id: 'p1' },
      );
    });

    it('does not audit a no-op update', async () => {
      (periodsRepo.findOneBy as jest.Mock).mockResolvedValue(
        schedulePeriod(makeSchedule('2026-10-11', '2027-01-22')),
      );

      await service.update('p1', { period_label: 'October 2026' }, 'admin1');

      expect(audit.log).not.toHaveBeenCalled();
    });
  });
});

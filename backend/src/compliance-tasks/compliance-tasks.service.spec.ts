import { Repository } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { ComplianceTask, GstFilingPeriod, User } from '../entities';
import {
  ComplianceCategory,
  GstFilingFrequency,
  TaskStatus,
  UserStatus,
  UserType,
} from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { SchedulingService } from '../schedule/scheduling.service';
import { ComplianceTasksService } from './compliance-tasks.service';

describe('ComplianceTasksService', () => {
  let tasksService: ComplianceTasksService;
  let saved: ComplianceTask[];
  let findMock: jest.Mock;
  let findOneMock: jest.Mock;
  let saveMock: jest.Mock;

  const notifications = {
    sendEmail: jest.fn().mockResolvedValue(true),
    sendPush: jest.fn().mockResolvedValue(true),
  };
  const audit = {
    log: jest.fn().mockResolvedValue({}),
  };
  const config = {
    get: jest.fn().mockReturnValue('admin@snbajaj.com'),
  } as unknown as ConfigService;

  const usersRepo = {
    findOneBy: jest.fn(),
    find: jest.fn(),
  } as unknown as Repository<User>;
  const periodsRepo = {
    findOneBy: jest.fn(),
    find: jest.fn(),
  } as unknown as Repository<GstFilingPeriod>;
  const tasksRepo = {} as unknown as Repository<ComplianceTask>;

  const monthlyUser = (overrides: Partial<User> = {}) =>
    ({
      id: 'u1',
      gst_filing_frequency: GstFilingFrequency.MONTHLY,
      user_type: UserType.GST,
      status: UserStatus.ACTIVE,
      ...overrides,
    }) as User;
  const quarterlyUser = (overrides: Partial<User> = {}) =>
    monthlyUser({
      id: 'u2',
      gst_filing_frequency: GstFilingFrequency.QUARTERLY,
      ...overrides,
    });

  const period = (periodCode: string, id = 'p1') =>
    ({
      id,
      period_code: periodCode,
      schedule: null,
    }) as GstFilingPeriod;

  beforeEach(() => {
    saved = [];
    findMock = jest
      .fn()
      .mockImplementation(
        (opts?: {
          where?: { user_id?: string; filing_period_id?: string };
        }) => {
          let rows = saved;
          if (opts?.where?.user_id)
            rows = rows.filter((r) => r.user_id === opts.where!.user_id);
          if (opts?.where?.filing_period_id)
            rows = rows.filter(
              (r) => r.filing_period_id === opts.where!.filing_period_id,
            );
          return Promise.resolve(rows);
        },
      );
    saveMock = jest
      .fn()
      .mockImplementation((rows: ComplianceTask[] | ComplianceTask) => {
        const list = Array.isArray(rows) ? rows : [rows];
        saved.push(...list);
        return Promise.resolve(rows);
      });
    findOneMock = jest.fn();
    Object.assign(tasksRepo, {
      find: findMock,
      save: saveMock,
      create: jest.fn((v: object) => v),
      findOne: findOneMock,
    });

    tasksService = new ComplianceTasksService(
      tasksRepo,
      usersRepo,
      periodsRepo,
      new SchedulingService(),
      notifications as unknown as NotificationsService,
      audit as unknown as AuditService,
      config,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('ensureTasksForPeriod', () => {
    it('creates the monthly set for a monthly filer', async () => {
      (usersRepo.findOneBy as jest.Mock).mockResolvedValue(monthlyUser());
      (periodsRepo.findOneBy as jest.Mock).mockResolvedValue(period('2026-10'));

      await tasksService.ensureTasksForPeriod('u1', 'p1');

      // sorted lexicographically by category value
      expect(saved.map((t) => t.category).sort()).toEqual([
        ComplianceCategory.GST_PAYMENT,
        ComplianceCategory.GSTR_1,
        ComplianceCategory.GSTR_3B,
      ]);
      expect(saveMock).toHaveBeenCalledTimes(1);
      expect(saved.every((t) => t.status === TaskStatus.PENDING)).toBe(true);
    });

    it('creates the quarterly set (iff + payment) for mid-quarter months', async () => {
      (usersRepo.findOneBy as jest.Mock).mockResolvedValue(quarterlyUser());
      (periodsRepo.findOneBy as jest.Mock).mockResolvedValue(period('2026-10'));

      await tasksService.ensureTasksForPeriod('u2', 'p1');

      expect(saved.map((t) => t.category).sort()).toEqual([
        ComplianceCategory.GST_PAYMENT,
        ComplianceCategory.IFF,
      ]);
    });

    it('adds the settling-month GSTR-3B for quarter-end months', async () => {
      (usersRepo.findOneBy as jest.Mock).mockResolvedValue(quarterlyUser());
      (periodsRepo.findOneBy as jest.Mock).mockResolvedValue(period('2026-12'));

      await tasksService.ensureTasksForPeriod('u2', 'p1');

      const gstr3b = saved.find(
        (t) => t.category === ComplianceCategory.GSTR_3B,
      );
      expect(gstr3b).toBeDefined();
      expect(new Date(gstr3b!.due_date!).toISOString()).toBe(
        '2027-01-22T00:00:00.000Z',
      );
      expect(saved.map((t) => t.category).sort()).toEqual([
        ComplianceCategory.GST_PAYMENT,
        ComplianceCategory.GSTR_3B,
        ComplianceCategory.IFF,
      ]);
    });

    it('is idempotent: existing tasks are never recreated', async () => {
      saved.push({
        id: 't1',
        user_id: 'u1',
        filing_period_id: 'p1',
        category: ComplianceCategory.GSTR_1,
        status: TaskStatus.PENDING,
      } as ComplianceTask);

      (usersRepo.findOneBy as jest.Mock).mockResolvedValue(monthlyUser());
      (periodsRepo.findOneBy as jest.Mock).mockResolvedValue(period('2026-10'));

      await tasksService.ensureTasksForPeriod('u1', 'p1');
      const firstCreateCount = saved.length;

      await tasksService.ensureTasksForPeriod('u1', 'p1');

      expect(saved).toHaveLength(firstCreateCount);
      expect(saved.map((t) => t.category).sort()).toEqual([
        ComplianceCategory.GST_PAYMENT,
        ComplianceCategory.GSTR_1,
        ComplianceCategory.GSTR_3B,
      ]);
    });

    it('fills missing categories when a legacy task set exists', async () => {
      // Legacy period already has the old sales/purchase rows for a monthly filer
      saved.push(
        {
          id: 't1',
          user_id: 'u1',
          filing_period_id: 'p1',
          category: ComplianceCategory.SALES_BILLS,
          status: TaskStatus.PENDING,
        } as ComplianceTask,
        {
          id: 't2',
          user_id: 'u1',
          filing_period_id: 'p1',
          category: ComplianceCategory.PURCHASE_BILLS,
          status: TaskStatus.PENDING,
        } as ComplianceTask,
      );

      (usersRepo.findOneBy as jest.Mock).mockResolvedValue(monthlyUser());
      (periodsRepo.findOneBy as jest.Mock).mockResolvedValue(period('2026-10'));

      await tasksService.ensureTasksForPeriod('u1', 'p1');

      expect(saved).toContainEqual(
        expect.objectContaining({ category: ComplianceCategory.GSTR_1 }),
      );
      expect(saved).toContainEqual(
        expect.objectContaining({ category: ComplianceCategory.GSTR_3B }),
      );
    });

    it('throws for a missing user or period', async () => {
      (usersRepo.findOneBy as jest.Mock).mockResolvedValue(null);
      (periodsRepo.findOneBy as jest.Mock).mockResolvedValue(period('2026-10'));
      await expect(
        tasksService.ensureTasksForPeriod('nope', 'p1'),
      ).rejects.toThrow(NotFoundException);

      (usersRepo.findOneBy as jest.Mock).mockResolvedValue(monthlyUser());
      (periodsRepo.findOneBy as jest.Mock).mockResolvedValue(null);
      await expect(
        tasksService.ensureTasksForPeriod('u1', 'nope'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('autoGenerateTasks (deprecated entry)', () => {
    it('delegates to ensureTasksForPeriod using the stored cadence', async () => {
      (usersRepo.findOneBy as jest.Mock).mockResolvedValue(quarterlyUser());
      (periodsRepo.findOneBy as jest.Mock).mockResolvedValue(period('2026-10'));

      // The old flag is ignored — cadence comes from the user record.
      await tasksService.autoGenerateTasks('u2', 'p1');

      expect(saved.map((t) => t.category).sort()).toEqual([
        ComplianceCategory.GST_PAYMENT,
        ComplianceCategory.IFF,
      ]);
    });
  });

  describe('generateAllForPeriod', () => {
    it('generates tasks for every active GST client and returns the count', async () => {
      (usersRepo.find as jest.Mock).mockResolvedValue([
        monthlyUser(),
        quarterlyUser(),
      ]);
      (usersRepo.findOneBy as jest.Mock).mockImplementation(
        (where: { id: string }) =>
          Promise.resolve(where.id === 'u1' ? monthlyUser() : quarterlyUser()),
      );
      (periodsRepo.findOneBy as jest.Mock).mockResolvedValue(period('2026-12'));

      const count = await tasksService.generateAllForPeriod('p1');

      expect(count).toBe(2);
      expect(saved).toHaveLength(6); // monthly 3 + quarterly (iff, payment, gstr_3b) 3
    });
  });

  describe('updateStatus', () => {
    it('rejects an unknown task', async () => {
      (tasksRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        tasksService.updateStatus('x', TaskStatus.COMPLETED),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markNil', () => {
    const periodRow = (overrides: Partial<GstFilingPeriod> = {}) =>
      ({ id: 'p1', period_code: '2026-10', ...overrides }) as GstFilingPeriod;

    const task = (overrides: Partial<ComplianceTask> = {}) =>
      ({
        id: 't1',
        user_id: 'u1',
        filing_period_id: 'p1',
        category: ComplianceCategory.GSTR_1,
        status: TaskStatus.PENDING,
        user: { id: 'u1', name: 'Amit', email: 'amit@example.com' },
        filing_period: periodRow(),
        ...overrides,
      }) as ComplianceTask;

    beforeEach(() => {
      audit.log.mockClear();
      notifications.sendEmail.mockClear();
    });

    it('marks a nil-eligible task as nil_declared and emails the admin', async () => {
      (tasksRepo.findOne as jest.Mock).mockResolvedValue(task());

      const result = await tasksService.markNil('t1', 'u1');

      expect(result.status).toBe(TaskStatus.NIL_DECLARED);
      expect(result.nil_declared_at).toBeInstanceOf(Date);
      expect(notifications.sendEmail).toHaveBeenCalledTimes(1);
      expect(notifications.sendEmail).toHaveBeenCalledWith(
        { email: 'admin@snbajaj.com', name: 'SN Bajaj And Co' },
        expect.stringContaining('Nil filing pending'),
        expect.stringContaining('amit@example.com'),
      );
    });

    it('rejects a task owned by another user', async () => {
      (tasksRepo.findOne as jest.Mock).mockResolvedValue(task());

      await expect(tasksService.markNil('t1', 'u2')).rejects.toThrow(
        ForbiddenException,
      );
      expect(notifications.sendEmail).not.toHaveBeenCalled();
    });

    it('rejects a nil that is not eligible', async () => {
      (tasksRepo.findOne as jest.Mock).mockResolvedValue(
        task({ category: ComplianceCategory.GST_PAYMENT }),
      );

      await expect(tasksService.markNil('t1', 'u1')).rejects.toThrow(
        BadRequestException,
      );
      expect(notifications.sendEmail).not.toHaveBeenCalled();
    });

    it('rejects an already completed or declared task', async () => {
      (tasksRepo.findOne as jest.Mock).mockResolvedValue(
        task({ status: TaskStatus.COMPLETED }),
      );
      await expect(tasksService.markNil('t1', 'u1')).rejects.toThrow(
        BadRequestException,
      );

      (tasksRepo.findOne as jest.Mock).mockResolvedValue(
        task({ status: TaskStatus.NIL_DECLARED }),
      );
      await expect(tasksService.markNil('t1', 'u1')).rejects.toThrow(
        BadRequestException,
      );
      expect(notifications.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('pendingNilFilings', () => {
    it('returns only nil-declared tasks with relations', async () => {
      findMock.mockResolvedValue([
        {
          id: 't1',
          category: ComplianceCategory.IFF,
          status: TaskStatus.NIL_DECLARED,
        },
      ]);

      const rows = await tasksService.pendingNilFilings();

      expect(findMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: TaskStatus.NIL_DECLARED },
        }),
      );
      expect(rows).toHaveLength(1);
    });
  });

  describe('confirmNil', () => {
    it('confirms a nil-declared task, completes it, and audits', async () => {
      const row = {
        id: 't1',
        user_id: 'u1',
        filing_period_id: 'p1',
        category: ComplianceCategory.GSTR_1,
        status: TaskStatus.NIL_DECLARED,
        filing_period: { id: 'p1', period_code: '2026-10' },
      };
      (tasksRepo.findOne as jest.Mock).mockResolvedValue(row);

      const result = await tasksService.confirmNil('t1', 'admin1');

      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(audit.log).toHaveBeenCalledWith(
        'admin1',
        'nil.confirmed',
        expect.any(Object),
        { user_id: 'u1', period_id: 'p1' },
      );
    });

    it('rejects a task not pending nil confirmation', async () => {
      (tasksRepo.findOne as jest.Mock).mockResolvedValue({
        id: 't1',
        user_id: 'u1',
        filing_period_id: 'p1',
        category: ComplianceCategory.GSTR_1,
        status: TaskStatus.PENDING,
      });

      await expect(tasksService.confirmNil('t1', 'admin1')).rejects.toThrow(
        BadRequestException,
      );
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('rejects an unknown task', async () => {
      (tasksRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(tasksService.confirmNil('nope', 'admin1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markUploadedForDocumentConfirm', () => {
    it('marks the first pending filing task UPLOADED', async () => {
      const row = {
        id: 't1',
        user_id: 'u1',
        filing_period_id: 'p1',
        category: ComplianceCategory.GSTR_1,
        status: TaskStatus.PENDING,
      };
      findOneMock.mockResolvedValue(row);

      const result = await tasksService.markUploadedForDocumentConfirm(
        'u1',
        'p1',
      );

      expect(result).not.toBeNull();
      expect(result!.status).toBe(TaskStatus.UPLOADED);
      expect(findOneMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user_id: 'u1',
            filing_period_id: 'p1',
            status: TaskStatus.PENDING,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('returns null when nothing is pending', async () => {
      (tasksRepo.findOne as jest.Mock).mockResolvedValue(null);

      const result = await tasksService.markUploadedForDocumentConfirm(
        'u1',
        'p1',
      );

      expect(result).toBeNull();
    });
  });
});

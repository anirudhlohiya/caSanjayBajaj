import { Repository } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import {
  ComplianceTask,
  GstFilingPeriod,
  Reminder,
  Report,
  User,
} from '../entities';
import {
  ComplianceCategory,
  GstFilingFrequency,
  TaskStatus,
  UserStatus,
  UserType,
} from '../common/enums';
import { ClientAlertsService } from '../notifications/client-alerts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ShareLinksService } from '../share-links/share-links.service';
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
  const reportsRepo = {
    findOneBy: jest.fn(),
  } as unknown as Repository<Report>;
  const remindersRepo = {
    create: jest.fn((v: object) => v),
    save: jest.fn((v: unknown) => Promise.resolve(v)),
  } as unknown as Repository<Reminder>;
  const alerts = {
    send: jest.fn().mockResolvedValue({
      in_app: true,
      push: true,
      email: true,
      whatsapp: false,
    }),
  };
  const shareLinks = {
    createLink: jest.fn().mockResolvedValue({ token: 'tok' }),
  };

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
      reportsRepo,
      remindersRepo,
      alerts as unknown as ClientAlertsService,
      shareLinks as unknown as ShareLinksService,
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
        user: {
          id: 'u1',
          name: 'Amit',
          email: 'amit@example.com',
          user_type: UserType.GST,
        },
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

  describe('markFiled', () => {
    const client = {
      id: 'u1',
      name: 'Amit Shah',
      email: 'amit@example.com',
      phone: '9876543210',
      user_type: UserType.GST,
    } as User;
    const filingTask = (overrides: Partial<ComplianceTask> = {}) =>
      ({
        id: 't1',
        user_id: 'u1',
        filing_period_id: 'p1',
        category: ComplianceCategory.GSTR_3B,
        status: TaskStatus.UPLOADED,
        filed_at: null,
        user: client,
        filing_period: { period_label: 'October 2026', period_code: '2026-10' },
        ...overrides,
      }) as unknown as ComplianceTask;

    it('completes the task, audits and alerts the client on all channels', async () => {
      findOneMock.mockResolvedValue(filingTask());

      const result = await tasksService.markFiled('t1', 'admin1', {
        arn: ' AA0810260123456 ',
      });
      await new Promise((r) => setImmediate(r));

      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(result.filed_at).toBeInstanceOf(Date);
      expect(result.arn).toBe('AA0810260123456');
      expect(result.filed_by).toBe('admin1');
      expect(audit.log).toHaveBeenCalledWith(
        'admin1',
        'compliance_task.filed',
        expect.objectContaining({ task_id: 't1', arn: 'AA0810260123456' }),
        { user_id: 'u1', period_id: 'p1' },
      );
      expect(alerts.send).toHaveBeenCalledWith(
        client,
        expect.objectContaining({
          title: 'GSTR-3B filed for October 2026',
          deepLink: '/documents',
          whatsapp: {
            template: 'returnFiled',
            params: ['Amit', 'GSTR-3B', 'October 2026', 'AA0810260123456'],
          },
        }),
      );
    });

    it('links an attached filed-return report and emails a secure link', async () => {
      findOneMock.mockResolvedValue(filingTask());
      (reportsRepo.findOneBy as jest.Mock).mockResolvedValue({
        id: 'r1',
        user_id: 'u1',
      });

      const result = await tasksService.markFiled('t1', 'admin1', {
        report_id: 'r1',
      });
      await new Promise((r) => setImmediate(r));

      expect(result.filed_report_id).toBe('r1');
      expect(shareLinks.createLink).toHaveBeenCalledWith('r1');
      const alert = (
        alerts.send.mock.calls[0] as [User, { emailExtraHtml: string }]
      )[1];
      expect(alert.emailExtraHtml).toContain('/public/report/download/tok');
    });

    it('rejects a report that belongs to another client', async () => {
      findOneMock.mockResolvedValue(filingTask());
      (reportsRepo.findOneBy as jest.Mock).mockResolvedValue({
        id: 'r1',
        user_id: 'someone-else',
      });

      await expect(
        tasksService.markFiled('t1', 'admin1', { report_id: 'r1' }),
      ).rejects.toThrow(BadRequestException);
      expect(alerts.send).not.toHaveBeenCalled();
    });

    it('refuses GST actions for a client without the GST service', async () => {
      findOneMock.mockResolvedValue(
        filingTask({
          user: { ...client, user_type: UserType.ITR },
        }),
      );
      await expect(tasksService.markFiled('t1', 'admin1', {})).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        tasksService.updateStatus('t1', TaskStatus.COMPLETED),
      ).rejects.toThrow(ForbiddenException);
      expect(alerts.send).not.toHaveBeenCalled();
    });

    it('refuses to file a payment task or an already-filed return', async () => {
      findOneMock.mockResolvedValueOnce(
        filingTask({ category: ComplianceCategory.GST_PAYMENT }),
      );
      await expect(tasksService.markFiled('t1', 'admin1', {})).rejects.toThrow(
        BadRequestException,
      );

      findOneMock.mockResolvedValueOnce(filingTask({ filed_at: new Date() }));
      await expect(tasksService.markFiled('t1', 'admin1', {})).rejects.toThrow(
        BadRequestException,
      );
      expect(alerts.send).not.toHaveBeenCalled();
    });
  });

  describe('sendPaymentReminder', () => {
    const client = {
      id: 'u1',
      name: 'Amit Shah',
      email: 'amit@example.com',
      phone: '9876543210',
      user_type: UserType.GST,
    } as User;
    const paymentTask = (overrides: Partial<ComplianceTask> = {}) =>
      ({
        id: 't9',
        user_id: 'u1',
        filing_period_id: 'p1',
        category: ComplianceCategory.GST_PAYMENT,
        status: TaskStatus.PENDING,
        amount: '14500.00',
        paid_at: null,
        due_date: new Date('2026-11-20T00:00:00.000Z'),
        user: client,
        filing_period: { period_label: 'October 2026' },
        ...overrides,
      }) as unknown as ComplianceTask;

    it('alerts the client and logs one reminder row per channel', async () => {
      findOneMock.mockResolvedValue(paymentTask());

      const result = await tasksService.sendPaymentReminder('t9', 'admin1');

      expect(alerts.send).toHaveBeenCalledWith(
        client,
        expect.objectContaining({
          whatsapp: {
            template: 'paymentReminder',
            params: ['Amit', 'October 2026', '14,500', '20 Nov 2026'],
          },
        }),
      );
      expect(result.channels.whatsapp).toBe(false);
      const rows = (remindersRepo.save as jest.Mock).mock.calls[0][0] as Array<{
        channel: string;
        status: string;
        triggered_by: string;
      }>;
      expect(rows.map((r) => [r.channel, r.status])).toEqual([
        ['push', 'sent'],
        ['email', 'sent'],
        ['whatsapp', 'failed'],
      ]);
      expect(rows.every((r) => r.triggered_by === 'admin1')).toBe(true);
      expect(result.task.payment_reminder_sent_at).toBeInstanceOf(Date);
      expect(audit.log).toHaveBeenCalledWith(
        'admin1',
        'payment_reminder.sent',
        expect.objectContaining({ task_id: 't9' }),
        { user_id: 'u1', period_id: 'p1' },
      );
    });

    it('requires an amount, an unpaid task and the payment category', async () => {
      for (const overrides of [
        { amount: null },
        { paid_at: new Date() },
        { category: ComplianceCategory.GSTR_1 },
      ]) {
        findOneMock.mockResolvedValueOnce(paymentTask(overrides));
        await expect(
          tasksService.sendPaymentReminder('t9', 'admin1'),
        ).rejects.toThrow(BadRequestException);
      }
      expect(alerts.send).not.toHaveBeenCalled();
    });
  });
});

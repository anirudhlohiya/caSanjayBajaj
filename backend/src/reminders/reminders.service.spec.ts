import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import {
  ComplianceCategory,
  GstFilingFrequency,
  ReminderChannel,
  ReminderStatus,
  TaskStatus,
} from '../common/enums';
import { ComplianceTask } from '../entities/compliance-task.entity';
import { Document } from '../entities/document.entity';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { Reminder } from '../entities/reminder.entity';
import { User } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { SchedulingService } from '../schedule/scheduling.service';
import { UsersService } from '../users/users.service';
import { RemindersService } from './reminders.service';

type TaskFindArgs = {
  where: {
    filing_period_id: string;
    category: ComplianceCategory;
  };
};

type EmailCall = [{ email: string; name?: string }, string, string];

describe('RemindersService', () => {
  let service: RemindersService;
  let remindersRepo: {
    exists: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let periodsRepo: { find: jest.Mock };
  let documentsRepo: { find: jest.Mock };
  let tasksRepo: {
    find: jest.Mock<Promise<ComplianceTask[]>, [TaskFindArgs]>;
    save: jest.Mock<Promise<ComplianceTask>, [ComplianceTask]>;
  };
  let notifications: { sendEmail: jest.Mock; sendPush: jest.Mock };
  let usersService: { getTokensForPush: jest.Mock; listActiveUsers: jest.Mock };
  let tasks: ComplianceTask[];
  const saved: Reminder[] = [];

  const monthlyUser = {
    id: 'user-monthly',
    name: 'Amit',
    email: 'amit@example.com',
    gst_filing_frequency: GstFilingFrequency.MONTHLY,
  } as User;

  const quarterlyUser = {
    id: 'user-quarterly',
    name: 'Ravi',
    email: 'ravi@example.com',
    gst_filing_frequency: GstFilingFrequency.QUARTERLY,
  } as User;

  const makePeriod = (
    id: string,
    schedule: GstFilingPeriod['schedule'],
  ): GstFilingPeriod =>
    ({
      id,
      period_label: 'October 2026',
      period_code: '2026-10',
      due_date: '2026-10-11',
      is_open: true,
      schedule,
    }) as GstFilingPeriod;

  const makeTask = (
    user: User,
    category: ComplianceCategory,
    opts: Partial<ComplianceTask> = {},
  ): ComplianceTask =>
    ({
      id: `task-${user.id}-${category}`,
      user_id: user.id,
      filing_period_id: 'p1',
      category,
      status: TaskStatus.PENDING,
      message_day: null,
      user,
      ...opts,
    }) as ComplianceTask;

  beforeEach(() => {
    saved.length = 0;
    tasks = [];
    remindersRepo = {
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn((v: object) => v),
      save: jest.fn((v: Reminder) => {
        if (!saved.includes(v)) saved.push(v);
        return Promise.resolve(v);
      }),
      createQueryBuilder: jest.fn(),
    };
    periodsRepo = { find: jest.fn().mockResolvedValue([]) };
    documentsRepo = { find: jest.fn().mockResolvedValue([]) };
    tasksRepo = {
      find: jest.fn(({ where }: TaskFindArgs) =>
        Promise.resolve(
          tasks.filter(
            (t) =>
              t.filing_period_id === where.filing_period_id &&
              t.category === where.category &&
              t.status === TaskStatus.PENDING,
          ),
        ),
      ),
      save: jest.fn((v: ComplianceTask) => Promise.resolve(v)),
    };
    notifications = {
      sendEmail: jest.fn().mockResolvedValue(true),
      sendPush: jest.fn().mockResolvedValue(true),
    };
    usersService = {
      getTokensForPush: jest.fn().mockResolvedValue([]),
      listActiveUsers: jest.fn().mockResolvedValue([]),
    };
    const config = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'nodeEnv') return 'development';
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new RemindersService(
      remindersRepo as unknown as Repository<Reminder>,
      periodsRepo as unknown as Repository<GstFilingPeriod>,
      documentsRepo as unknown as Repository<Document>,
      tasksRepo as unknown as Repository<ComplianceTask>,
      notifications as unknown as NotificationsService,
      usersService as unknown as UsersService,
      config,
      new SchedulingService(),
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('handleAutoReminders', () => {
    it('targets a pending monthly gstr_1 on GSTR-1 day1 and logs system sends', async () => {
      periodsRepo.find.mockResolvedValue([makePeriod('p1', null)]);
      tasks = [makeTask(monthlyUser, ComplianceCategory.GSTR_1)];
      usersService.getTokensForPush.mockResolvedValue([
        { push_token: '{"endpoint":"e","keys":{"p256dh":"k","auth":"a"}}' },
      ]);

      await service.handleAutoReminders('2026-10-05');

      expect(tasksRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            filing_period_id: 'p1',
            category: ComplianceCategory.GSTR_1,
          }) as TaskFindArgs['where'],
        }),
      );
      expect(notifications.sendEmail).toHaveBeenCalledTimes(1);
      expect(notifications.sendPush).toHaveBeenCalledTimes(1);
      const sent = saved.filter((r) => r.triggered_by === 'system');
      expect(sent.length).toBe(2); // email + push
      expect(sent.every((r) => r.status === ReminderStatus.SENT)).toBe(true);
      expect(tasksRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ message_day: 0 }),
      );
    });

    it('advances the message-day slot on GSTR-1 day2', async () => {
      periodsRepo.find.mockResolvedValue([makePeriod('p1', null)]);
      tasks = [
        makeTask(monthlyUser, ComplianceCategory.GSTR_1, { message_day: 0 }),
      ];

      await service.handleAutoReminders('2026-10-07');

      expect(notifications.sendEmail).toHaveBeenCalledTimes(1);
      expect(tasksRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ message_day: 1 }),
      );
    });

    it('skips tasks already reminded for the same or later slot', async () => {
      periodsRepo.find.mockResolvedValue([makePeriod('p1', null)]);
      tasks = [
        makeTask(monthlyUser, ComplianceCategory.GSTR_1, { message_day: 0 }),
      ];

      await service.handleAutoReminders('2026-10-05');

      expect(notifications.sendEmail).not.toHaveBeenCalled();
      expect(notifications.sendPush).not.toHaveBeenCalled();
    });

    it('skips completed/uploaded/nil_declared tasks', async () => {
      periodsRepo.find.mockResolvedValue([makePeriod('p1', null)]);
      tasks = [
        makeTask(monthlyUser, ComplianceCategory.GSTR_1, {
          status: TaskStatus.COMPLETED,
        }),
        makeTask(monthlyUser, ComplianceCategory.IFF, {
          status: TaskStatus.UPLOADED,
        }),
        makeTask(monthlyUser, ComplianceCategory.GSTR_3B, {
          status: TaskStatus.NIL_DECLARED,
        }),
      ];

      await service.handleAutoReminders('2026-10-05');

      expect(notifications.sendEmail).not.toHaveBeenCalled();
      expect(notifications.sendPush).not.toHaveBeenCalled();
    });

    it('reminds monthly filers on GSTR-1 day and quarterly filers on IFF day', async () => {
      periodsRepo.find.mockResolvedValue([makePeriod('p1', null)]);
      tasks = [
        makeTask(monthlyUser, ComplianceCategory.GSTR_1),
        makeTask(quarterlyUser, ComplianceCategory.IFF),
      ];

      // The 5th fires both GSTR-1 and IFF matches (same day in the default
      // schedule); each chains to its own cadence's task.
      await service.handleAutoReminders('2026-10-05');

      expect(notifications.sendEmail).toHaveBeenCalledTimes(2);
      const emails = notifications.sendEmail.mock
        .calls as unknown as EmailCall[];
      expect(
        emails.some(
          (c) => c[0].email === 'amit@example.com' && c[2].includes('GSTR-1'),
        ),
      ).toBe(true);
      expect(
        emails.some(
          (c) => c[0].email === 'ravi@example.com' && c[2].includes('IFF'),
        ),
      ).toBe(true);
    });

    it('uses the monthly GSTR-3B copy on the 18th for monthly filers', async () => {
      periodsRepo.find.mockResolvedValue([makePeriod('p1', null)]);
      tasks = [makeTask(monthlyUser, ComplianceCategory.GSTR_3B)];

      await service.handleAutoReminders('2026-10-18');

      expect(notifications.sendEmail).toHaveBeenCalledTimes(1);
      const email = (
        notifications.sendEmail.mock.calls as unknown as EmailCall[]
      )[0];
      expect(email[2]).toContain('purchase bills (GSTR-3B)');
    });

    it('uses the quarterly GSTR-3B copy for the quarter-end period', async () => {
      const quarterEnd = {
        id: 'p-dec',
        period_label: 'December 2026',
        period_code: '2026-12',
        due_date: '2026-12-11',
        is_open: true,
        schedule: null,
      } as GstFilingPeriod;
      periodsRepo.find.mockResolvedValue([quarterEnd]);
      tasks = [
        {
          ...makeTask(quarterlyUser, ComplianceCategory.GSTR_3B),
          filing_period_id: 'p-dec',
        },
      ];

      await service.handleAutoReminders('2027-01-20');

      const email = (
        notifications.sendEmail.mock.calls as unknown as EmailCall[]
      )[0];
      expect(email[0]).toMatchObject({ email: 'ravi@example.com' });
      expect(email[2]).toContain('Oct–Dec 2026 purchase bills');
    });

    it('does not auto-send payment reminders', async () => {
      periodsRepo.find.mockResolvedValue([makePeriod('p1', null)]);
      tasks = [makeTask(monthlyUser, ComplianceCategory.GST_PAYMENT)];

      await service.handleAutoReminders('2026-10-20');

      expect(notifications.sendEmail).not.toHaveBeenCalled();
      expect(notifications.sendPush).not.toHaveBeenCalled();
    });

    it('does not resend a slot already logged today', async () => {
      periodsRepo.find.mockResolvedValue([makePeriod('p1', null)]);
      tasks = [makeTask(monthlyUser, ComplianceCategory.GSTR_1)];
      // PUSH already logged today -> skipped; EMAIL proceeds
      remindersRepo.exists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await service.handleAutoReminders('2026-10-05');

      expect(notifications.sendPush).not.toHaveBeenCalled();
      expect(notifications.sendEmail).toHaveBeenCalledTimes(1);
      const sent = saved.filter((r) => r.status === ReminderStatus.SENT);
      expect(sent.length).toBe(1);
      expect(sent[0].channel).toBe(ReminderChannel.EMAIL);
    });
  });
});

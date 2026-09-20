import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { CronJob } from 'cron';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { paginate, PaginatedResult } from '../common/dto/pagination';
import { ReminderChannel, ReminderStatus, TaskStatus } from '../common/enums';
import { ComplianceTask } from '../entities/compliance-task.entity';
import { Document } from '../entities/document.entity';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { Reminder } from '../entities/reminder.entity';
import { User } from '../entities/user.entity';
import {
  NotificationsService,
  isPushSubscription,
} from '../notifications/notifications.service';
import { SchedulingService } from '../schedule/scheduling.service';
import { UsersService } from '../users/users.service';
import { ReminderLogQueryDto, SendReminderDto } from './dto/reminder.dto';
import { ReminderCopy, buildReminderCopy } from './reminder-copy';

/** Server-local YYYY-MM-DD (reminder dates are calendar dates, not UTC). */
function localDateStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Injectable()
export class RemindersService implements OnModuleInit {
  private readonly logger = new Logger(RemindersService.name);
  /** The cron job name is stable so re-registration (hot reload) is idempotent. */
  private readonly cronJobName = 'task-reminders';

  constructor(
    @InjectRepository(Reminder)
    private readonly reminders: Repository<Reminder>,
    @InjectRepository(GstFilingPeriod)
    private readonly periods: Repository<GstFilingPeriod>,
    @InjectRepository(Document)
    private readonly documents: Repository<Document>,
    @InjectRepository(ComplianceTask)
    private readonly tasks: Repository<ComplianceTask>,
    private readonly notifications: NotificationsService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
    private readonly scheduling: SchedulingService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  /**
   * Register the auto-reminder cron from config (docs/13 §5.2). Expression is
   * TASK_REMINDER_CRON (default 0 8 * * * = 08:00 server time).
   */
  onModuleInit(): void {
    if (this.config.get('nodeEnv') === 'test') return;

    if (this.scheduler.doesExist('cron', this.cronJobName)) return;

    const expression =
      this.config.get<string>('reminders.taskCron') ?? '0 8 * * *';
    const job = new CronJob(expression, () => {
      void this.handleAutoReminders().catch((err) => {
        this.logger.error(
          `Auto reminder cron (${expression}) failed`,
          err instanceof Error ? err.stack : err,
        );
      });
    });
    this.scheduler.addCronJob(this.cronJobName, job);
    job.start();
    this.logger.log(`Auto reminders scheduled on cron "${expression}"`);
  }

  async sendReminder(
    auth: AuthUser | null,
    dto: SendReminderDto,
  ): Promise<{ total: number; sent: number }> {
    const period = await this.periods.findOneBy({ id: dto.filing_period_id });
    if (!period) throw new NotFoundException('Filing period not found');

    const triggeredBy = auth ? auth.sub : 'system';

    let targets: string[] = [];
    if (dto.all_unfiled) {
      // Clients who have NOT uploaded any document for this period
      const uploaded = await this.documents.find({
        where: { filing_period_id: period.id },
      });
      const uploadedUserIds = new Set(uploaded.map((d) => d.user_id));
      const allUsers = await this.usersService.listActiveUsers();
      targets = allUsers
        .filter((u) => !uploadedUserIds.has(u.id))
        .map((u) => u.id);
    } else if (dto.user_id) {
      targets = [dto.user_id];
    } else {
      throw new NotFoundException('Provide user_id or all_unfiled');
    }

    let sent = 0;
    for (const userId of targets) {
      for (const channel of dto.channels) {
        // Duplicate guard: skip if a SENT reminder already exists for this user+period+channel today
        const alreadySent = await this.reminders.exists({
          where: {
            user_id: userId,
            filing_period_id: period.id,
            channel,
            status: ReminderStatus.SENT,
            triggered_by: triggeredBy,
          },
        });
        if (alreadySent) continue;

        const reminder = await this.reminders.save(
          this.reminders.create({
            user_id: userId,
            filing_period_id: period.id,
            channel,
            status: ReminderStatus.QUEUED,
            triggered_by: triggeredBy,
          }),
        );

        let ok = false;
        try {
          ok = await this.deliver(userId, channel, period);
        } catch (error) {
          this.logger.error(
            `Reminder delivery failed: ${(error as Error).message}`,
          );
        }
        reminder.status = ok ? ReminderStatus.SENT : ReminderStatus.FAILED;
        reminder.sent_at = ok ? new Date() : null;
        await this.reminders.save(reminder);
        if (ok) sent++;
      }
    }
    return { total: targets.length * dto.channels.length, sent };
  }

  private async deliver(
    userId: string,
    channel: ReminderChannel,
    period: GstFilingPeriod,
  ): Promise<boolean> {
    const user = await this.usersService.findOne(userId);
    const title = 'Documents due for GST filing';
    const body = `Your ${period.period_label} documents are due by ${period.due_date}. Please upload them in the app.`;
    const url = `${process.env.API_BASE_URL ?? ''}/documents/upload`;

    if (channel === ReminderChannel.EMAIL) {
      return this.notifications.sendEmail(
        { email: user.email, name: user.name },
        title,
        `<p>Dear ${user.name},</p><p>${body}</p><p><a href="${url}">Upload documents</a></p>`,
      );
    }
    return this.pushToUser(user, title, body, url);
  }

  private async pushToUser(
    user: User,
    title: string,
    body: string,
    url: string,
  ): Promise<boolean> {
    const tokens = await this.usersService.getTokensForPush(user.id);
    let ok = false;
    for (const token of tokens) {
      let subscription: unknown;
      try {
        subscription = JSON.parse(token.push_token);
      } catch {
        subscription = null;
      }
      if (
        isPushSubscription(subscription) &&
        (await this.notifications.sendPush(subscription, { title, body, url }))
      ) {
        ok = true;
      }
    }
    return ok;
  }

  async log(query: ReminderLogQueryDto): Promise<PaginatedResult<Reminder>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const qb = this.reminders
      .createQueryBuilder('reminder')
      .leftJoinAndSelect('reminder.user', 'user')
      .leftJoinAndSelect('reminder.filing_period', 'period')
      .orderBy('reminder.created_at', 'DESC');

    if (query.filing_period_id)
      qb.andWhere('reminder.filing_period_id = :pid', {
        pid: query.filing_period_id,
      });
    if (query.channel)
      qb.andWhere('reminder.channel = :channel', { channel: query.channel });
    if (query.status)
      qb.andWhere('reminder.status = :status', { status: query.status });
    if (query.triggered_by)
      qb.andWhere('reminder.triggered_by = :tb', { tb: query.triggered_by });

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return paginate(items, total, page, pageSize);
  }

  // ----- Scheduled job: auto reminders (docs/13 §5.2) -----
  // Registered dynamically in onModuleInit; the expression comes from config.

  async handleAutoReminders(today: string = localDateStr()): Promise<void> {
    if (this.config.get('nodeEnv') === 'test') return;

    const periods = await this.periods.find({ where: { is_open: true } });
    let matchesTotal = 0;
    let sentTotal = 0;

    for (const period of periods) {
      const schedule = this.scheduling.scheduleFor(period);
      const matches = this.scheduling.remindersOn(
        today,
        schedule,
        period.period_code,
      );
      // Order matches so earlier slots and non-quarterly come first.
      matches.sort((a, b) => a.slot - b.slot);
      for (const match of matches) {
        matchesTotal++;
        sentTotal += await this.runAutoMatch(period, match);
      }
    }

    if (matchesTotal > 0 || sentTotal > 0) {
      this.logger.log(
        `Auto reminders ${today}: ${matchesTotal} match(es), ${sentTotal} send(s)`,
      );
    }
  }

  private async runAutoMatch(
    period: GstFilingPeriod,
    match: ReturnType<SchedulingService['remindersOn']>[number],
  ): Promise<number> {
    const pendingTasks = await this.tasks.find({
      where: {
        filing_period_id: period.id,
        category: match.category,
        status: In([TaskStatus.PENDING]),
      },
      relations: { user: true },
    });

    let sent = 0;
    for (const task of pendingTasks) {
      const user = task.user;
      if (!user || user.gst_filing_frequency !== match.cadence) continue;

      // Task-day dedupe: don't re-send a slot we already covered
      if (task.message_day !== null && task.message_day >= match.slot) continue;

      const copy = buildReminderCopy({
        category: match.category,
        slot: match.slot,
        name: user.name,
        month: match.month,
        quarter: match.quarter,
        due: match.due,
      });

      let anyOk = false;
      for (const channel of [ReminderChannel.PUSH, ReminderChannel.EMAIL]) {
        const alreadyToday = await this.reminders.exists({
          where: {
            user_id: user.id,
            filing_period_id: period.id,
            channel,
            status: ReminderStatus.SENT,
            triggered_by: 'system',
            sent_at: MoreThanOrEqual(startOfLocalDay()),
          },
        });
        if (alreadyToday) continue;

        const reminder = await this.reminders.save(
          this.reminders.create({
            user_id: user.id,
            filing_period_id: period.id,
            channel,
            status: ReminderStatus.QUEUED,
            triggered_by: 'system',
          }),
        );

        let ok = false;
        try {
          ok = await this.deliverAuto(user, channel, copy);
        } catch (error) {
          this.logger.error(
            `Auto reminder delivery failed: ${(error as Error).message}`,
          );
        }
        reminder.status = ok ? ReminderStatus.SENT : ReminderStatus.FAILED;
        reminder.sent_at = ok ? new Date() : null;
        await this.reminders.save(reminder);
        if (ok) anyOk = true;
      }

      if (anyOk) {
        // Message-day marker: this slot was covered for this task
        task.message_day = match.slot;
        await this.tasks.save(task);
        sent++;
      }
    }
    return sent;
  }

  private async deliverAuto(
    user: User,
    channel: ReminderChannel,
    copy: ReminderCopy,
  ): Promise<boolean> {
    const url = `${process.env.API_BASE_URL ?? ''}/documents/upload`;
    if (channel === ReminderChannel.EMAIL) {
      return this.notifications.sendEmail(
        { email: user.email, name: user.name },
        copy.title,
        `<p>${copy.body}</p><p><a href="${url}">Upload documents</a></p>`,
      );
    }
    return this.pushToUser(user, copy.title, copy.body, url);
  }
}

function startOfLocalDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

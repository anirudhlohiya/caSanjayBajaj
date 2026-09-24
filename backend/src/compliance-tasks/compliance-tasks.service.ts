import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
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
  ReminderChannel,
  ReminderStatus,
  TaskStatus,
  UserStatus,
  UserType,
} from '../common/enums';
import { PeriodSchedule, TaskSchedule } from '../common/types/gst-schedule';
import {
  ClientAlertResult,
  ClientAlertsService,
} from '../notifications/client-alerts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SchedulingService } from '../schedule/scheduling.service';
import { ShareLinksService } from '../share-links/share-links.service';
import { advanceFilingTaskOnUpload } from './task-upload.util';

interface DesiredTask {
  category: ComplianceCategory;
  due_date: Date;
}

@Injectable()
export class ComplianceTasksService {
  private readonly logger = new Logger(ComplianceTasksService.name);

  constructor(
    @InjectRepository(ComplianceTask)
    private readonly tasksRepository: Repository<ComplianceTask>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(GstFilingPeriod)
    private readonly periodsRepository: Repository<GstFilingPeriod>,
    private readonly scheduling: SchedulingService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    @InjectRepository(Report)
    private readonly reportsRepository: Repository<Report>,
    @InjectRepository(Reminder)
    private readonly remindersRepository: Repository<Reminder>,
    private readonly alerts: ClientAlertsService,
    private readonly shareLinks: ShareLinksService,
  ) {}

  async listForClient(
    userId: string,
    periodId?: string,
  ): Promise<ComplianceTask[]> {
    const where: FindOptionsWhere<ComplianceTask> = { user_id: userId };
    if (periodId) where.filing_period_id = periodId;

    return this.tasksRepository.find({
      where,
      relations: { filing_period: true },
      order: { created_at: 'ASC' },
    });
  }

  /**
   * Idempotently ensure a user has the task set for a period per their cadence
   * (docs/13 §5.1): any existing user+period+category rows are left untouched.
   * Returns the full task list for the period.
   */
  async ensureTasksForPeriod(
    userId: string,
    periodId: string,
  ): Promise<ComplianceTask[]> {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');
    const period = await this.periodsRepository.findOneBy({ id: periodId });
    if (!period) throw new NotFoundException('Filing period not found');

    const schedule = this.scheduling.scheduleFor(period);
    const desired = this.desiredTasksFor(
      user.gst_filing_frequency,
      schedule,
      this.scheduling.quarterForPeriodCode(period.period_code).endsQuarter,
    );

    const existing = await this.tasksRepository.find({
      where: { user_id: userId, filing_period_id: periodId },
    });
    const existingKeys = new Set(existing.map((t) => t.category));
    const toCreate = desired.filter((d) => !existingKeys.has(d.category));

    if (toCreate.length > 0) {
      await this.tasksRepository.save(
        toCreate.map((d) =>
          this.tasksRepository.create({
            user_id: userId,
            filing_period_id: periodId,
            category: d.category,
            status: TaskStatus.PENDING,
            due_date: d.due_date,
          }),
        ),
      );
    }

    return this.listForClient(userId, periodId);
  }

  /**
   * Generate tasks for the period across every active GST client. Returns the
   * number of clients processed (docs/13 §5.1 step 2).
   */
  async generateAllForPeriod(periodId: string): Promise<number> {
    const clients = await this.usersRepository.find({
      where: {
        user_type: In([UserType.GST, UserType.BOTH]),
        status: UserStatus.ACTIVE,
      },
    });
    for (const client of clients) {
      await this.ensureTasksForPeriod(client.id, periodId);
    }
    return clients.length;
  }

  /**
   * Backwards-compatible entry used by existing client/admin apps. The client
   * cadence is read from the user record, not the old `isQuarterly` flag.
   * @deprecated use `ensureTasksForPeriod`.
   */
  async autoGenerateTasks(
    userId: string,
    periodId: string,
  ): Promise<ComplianceTask[]> {
    return this.ensureTasksForPeriod(userId, periodId);
  }

  /**
   * The task set per cadence (docs/13 §3.2):
   * - monthly → gstr_1 (sales bills), gstr_3b (purchase bills), gst_payment
   * - quarterly → iff (monthly), gst_payment (monthly), and gstr_3b only in
   *   the month that ends the quarter (due 22nd of the following month).
   */
  private desiredTasksFor(
    cadence: GstFilingFrequency,
    schedule: PeriodSchedule,
    endsQuarter: boolean,
  ): DesiredTask[] {
    if (cadence === GstFilingFrequency.QUARTERLY) {
      const tasks: DesiredTask[] = [
        {
          category: ComplianceCategory.IFF,
          due_date: this.parseDate(schedule.iff.due),
        },
        {
          category: ComplianceCategory.GST_PAYMENT,
          due_date: this.parseDate(schedule.payment.due),
        },
      ];
      if (endsQuarter && schedule.quarterly?.gstr3b) {
        tasks.push({
          category: ComplianceCategory.GSTR_3B,
          due_date: this.parseDate(schedule.quarterly.gstr3b.due),
        });
      }
      return tasks;
    }

    return this.mapFrom(
      [schedule.gstr1, schedule.gstr3b, schedule.payment],
      [
        ComplianceCategory.GSTR_1,
        ComplianceCategory.GSTR_3B,
        ComplianceCategory.GST_PAYMENT,
      ],
    );
  }

  private mapFrom(
    schedules: TaskSchedule[],
    categories: ComplianceCategory[],
  ): DesiredTask[] {
    return schedules.map((s, i) => ({
      category: categories[i],
      due_date: this.parseDate(s.due),
    }));
  }

  private parseDate(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }

  async updatePayment(
    id: string,
    amount: string | null,
    paidAt: Date | null,
  ): Promise<ComplianceTask> {
    const task = await this.tasksRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    task.amount = amount;
    if (paidAt) {
      task.paid_at = paidAt;
      task.status = TaskStatus.COMPLETED;
    } else {
      task.paid_at = null;
      task.status = TaskStatus.PENDING;
    }
    return this.tasksRepository.save(task);
  }

  async updateStatus(id: string, status: TaskStatus): Promise<ComplianceTask> {
    const task = await this.tasksRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    task.status = status;
    return this.tasksRepository.save(task);
  }

  /**
   * Advances the client's first still-open filing task for a period to
   * UPLOADED after they confirm a document upload (docs/13 §5.2). This is what
   * stops the task-slack reminders once evidence is on file. Returns null when
   * nothing is pending.
   */
  async markUploadedForDocumentConfirm(
    userId: string,
    periodId: string,
  ): Promise<ComplianceTask | null> {
    return advanceFilingTaskOnUpload(this.tasksRepository, userId, periodId);
  }

  /** Categories the client may declare nil (docs/13 §3.2). Payments are excluded. */
  private static nilEligible(category: ComplianceCategory): boolean {
    return [
      ComplianceCategory.GSTR_1,
      ComplianceCategory.GSTR_3B,
      ComplianceCategory.IFF,
    ].includes(category);
  }

  /**
   * Client-initiated nil declaration (docs/13 §3.5 / §6.3). Owner-guarded,
   * only nil-eligible categories, only on a still-open task. Once declared
   * the admin is emailed so they can confirm against the portal queue.
   */
  async markNil(id: string, userId: string): Promise<ComplianceTask> {
    const task = await this.tasksRepository.findOne({
      where: { id },
      relations: { user: true, filing_period: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.user_id !== userId) {
      throw new ForbiddenException('Not your compliance task');
    }
    if (!ComplianceTasksService.nilEligible(task.category)) {
      throw new BadRequestException('This task cannot be filed as nil');
    }
    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.NIL_DECLARED
    ) {
      throw new BadRequestException(
        `Task is already ${task.status}; cannot declare nil`,
      );
    }

    task.status = TaskStatus.NIL_DECLARED;
    task.nil_declared_at = new Date();
    const saved = await this.tasksRepository.save(task);
    void this.notifyNilPending(saved);
    return saved;
  }

  /** Admin pending-nil queue (docs/13 §6.5): all nil-declared tasks, newest first. */
  async pendingNilFilings(): Promise<ComplianceTask[]> {
    return this.tasksRepository.find({
      where: { status: TaskStatus.NIL_DECLARED },
      relations: { user: true, filing_period: true },
      order: { nil_declared_at: 'DESC' },
    });
  }

  /**
   * Admin confirms a nil filing → task completes (docs/13 §3.5). The action
   * is recorded in the audit log.
   */
  async confirmNil(id: string, adminId: string): Promise<ComplianceTask> {
    const task = await this.tasksRepository.findOne({
      where: { id },
      relations: { user: true, filing_period: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== TaskStatus.NIL_DECLARED) {
      throw new BadRequestException('Task is not pending nil confirmation');
    }

    task.status = TaskStatus.COMPLETED;
    const saved = await this.tasksRepository.save(task);
    await this.audit.log(
      adminId,
      'nil.confirmed',
      {
        task_id: task.id,
        category: task.category,
        period: task.filing_period?.period_code ?? null,
      },
      { user_id: task.user_id, period_id: task.filing_period_id },
    );
    return saved;
  }

  /**
   * CA marks a return (GSTR-1 / IFF / GSTR-3B) as filed. Completes the task,
   * records ARN + optional filed-return PDF, audits, and alerts the client on
   * every channel (in-app, push, email, WhatsApp template). One-shot: a task
   * that is already filed is rejected so the client never gets duplicates.
   */
  async markFiled(
    id: string,
    adminId: string,
    dto: { arn?: string; report_id?: string },
  ): Promise<ComplianceTask> {
    const task = await this.tasksRepository.findOne({
      where: { id },
      relations: { user: true, filing_period: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (!ComplianceTasksService.nilEligible(task.category)) {
      throw new BadRequestException(
        'Only GSTR-1, IFF and GSTR-3B tasks can be marked as filed',
      );
    }
    if (task.filed_at) {
      throw new BadRequestException('This return is already marked as filed');
    }

    let report: Report | null = null;
    if (dto.report_id) {
      report = await this.reportsRepository.findOneBy({ id: dto.report_id });
      if (!report || report.user_id !== task.user_id) {
        throw new BadRequestException(
          'Attached report does not belong to this client',
        );
      }
    }

    task.status = TaskStatus.COMPLETED;
    task.filed_at = new Date();
    task.filed_by = adminId;
    task.arn = dto.arn?.trim() || null;
    task.filed_report_id = report?.id ?? null;
    const saved = await this.tasksRepository.save(task);

    await this.audit.log(
      adminId,
      'compliance_task.filed',
      {
        task_id: task.id,
        category: task.category,
        period: task.filing_period?.period_code ?? null,
        arn: task.arn,
        report_id: task.filed_report_id,
      },
      { user_id: task.user_id, period_id: task.filing_period_id },
    );

    void this.notifyFiled(saved, report);
    return saved;
  }

  private async notifyFiled(
    task: ComplianceTask,
    report: Report | null,
  ): Promise<void> {
    try {
      const user = task.user;
      if (!user) return;
      const returnLabel = categoryLabel(task.category);
      const period = task.filing_period?.period_label ?? 'this period';
      const arnText = task.arn ? ` ARN: ${task.arn}.` : '';

      let emailExtraHtml = '';
      if (report) {
        try {
          const { token } = await this.shareLinks.createLink(report.id);
          const shareUrl = `${this.config.get<string>('apiBaseUrl') ?? ''}/api/v1/public/report/download/${token}`;
          emailExtraHtml = `<p><a href="${shareUrl}">Download the filed return (secure link, valid 30 days)</a></p>`;
        } catch (error) {
          this.logger.warn(
            `Could not create share link for report ${report.id}: ${(error as Error).message}`,
          );
        }
      }

      await this.alerts.send(user, {
        title: `${returnLabel} filed for ${period}`,
        body: `Your ${returnLabel} return for ${period} has been filed successfully.${arnText}`,
        deepLink: '/documents',
        emailExtraHtml,
        whatsapp: {
          template: 'returnFiled',
          params: [
            firstName(user.name),
            returnLabel,
            period,
            task.arn ?? 'will be shared in the app',
          ],
        },
      });
    } catch (error) {
      this.logger.error(
        `Filed notification failed for task ${task.id}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Manual GST payment reminder sent by the CA (never automatic). Requires
   * the payable amount to be set on the client's gst_payment task. Every
   * channel attempt is logged in `reminders` and the action is audited.
   */
  async sendPaymentReminder(
    id: string,
    adminId: string,
  ): Promise<{ task: ComplianceTask; channels: ClientAlertResult }> {
    const task = await this.tasksRepository.findOne({
      where: { id },
      relations: { user: true, filing_period: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.category !== ComplianceCategory.GST_PAYMENT) {
      throw new BadRequestException(
        'Payment reminders can only be sent for GST payment tasks',
      );
    }
    if (task.paid_at || task.status === TaskStatus.COMPLETED) {
      throw new BadRequestException('This payment is already marked as paid');
    }
    if (!task.amount || Number(task.amount) <= 0) {
      throw new BadRequestException(
        'Set the GST payable amount before sending a reminder',
      );
    }

    const user = task.user;
    const period = task.filing_period?.period_label ?? 'this period';
    const amount = formatInr(task.amount);
    const due = task.due_date ? formatDate(task.due_date) : 'the due date';

    const channels = await this.alerts.send(user, {
      title: `GST payment due for ${period}`,
      body: `Your GST payable for ${period} is ₹${amount}, due on ${due}. Please make the payment and share the challan with us.`,
      deepLink: '/reminders',
      whatsapp: {
        template: 'paymentReminder',
        params: [firstName(user.name), period, amount, due],
      },
    });

    const now = new Date();
    const logged: Array<[ReminderChannel, boolean]> = [
      [ReminderChannel.PUSH, channels.push],
      [ReminderChannel.EMAIL, channels.email],
      [ReminderChannel.WHATSAPP, channels.whatsapp],
    ];
    await this.remindersRepository.save(
      logged.map(([channel, ok]) =>
        this.remindersRepository.create({
          user_id: task.user_id,
          filing_period_id: task.filing_period_id,
          channel,
          status: ok ? ReminderStatus.SENT : ReminderStatus.FAILED,
          sent_at: ok ? now : null,
          triggered_by: adminId,
        }),
      ),
    );

    task.payment_reminder_sent_at = now;
    const saved = await this.tasksRepository.save(task);
    await this.audit.log(
      adminId,
      'payment_reminder.sent',
      { task_id: task.id, amount: task.amount, channels },
      { user_id: task.user_id, period_id: task.filing_period_id },
    );
    return { task: saved, channels };
  }

  /** Best-effort admin email alert for a fresh nil declaration (docs/13 §10.3). */
  private async notifyNilPending(task: ComplianceTask): Promise<void> {
    try {
      const to = this.config.get<string>('nilFiling.adminNotifyEmail');
      const user = task.user;
      if (!to || !user) return;
      await this.notifications.sendEmail(
        { email: to, name: 'SN Bajaj And Co' },
        `Nil filing pending — ${task.filing_period?.period_label ?? ''}`,
        `<p>${user.name} (${user.email}) has declared their ` +
          `${
            task.filing_period?.period_label ?? 'period'
          } ${task.category} as <strong>nil</strong>.</p>` +
          `<p>Please confirm it in the admin portal.</p>`,
      );
    } catch (error) {
      this.logger.error(
        `Nil pending admin email failed: ${(error as Error).message}`,
      );
    }
  }
}

const CATEGORY_LABELS: Partial<Record<ComplianceCategory, string>> = {
  [ComplianceCategory.GSTR_1]: 'GSTR-1',
  [ComplianceCategory.IFF]: 'IFF',
  [ComplianceCategory.GSTR_3B]: 'GSTR-3B',
  [ComplianceCategory.GST_PAYMENT]: 'GST payment',
};

function categoryLabel(category: ComplianceCategory): string {
  return CATEGORY_LABELS[category] ?? category.replace(/_/g, ' ').toUpperCase();
}

function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] || 'there';
}

function formatInr(amount: string): string {
  return Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

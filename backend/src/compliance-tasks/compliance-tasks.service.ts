import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { ComplianceTask, GstFilingPeriod, User } from '../entities';
import {
  ComplianceCategory,
  GstFilingFrequency,
  TaskStatus,
  UserStatus,
  UserType,
} from '../common/enums';
import { PeriodSchedule, TaskSchedule } from '../common/types/gst-schedule';
import { NotificationsService } from '../notifications/notifications.service';
import { SchedulingService } from '../schedule/scheduling.service';

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
      where: { user_type: UserType.GST, status: UserStatus.ACTIVE },
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

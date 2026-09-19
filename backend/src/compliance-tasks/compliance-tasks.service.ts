import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ComplianceTask, GstFilingPeriod, User } from '../entities';
import {
  ComplianceCategory,
  GstFilingFrequency,
  TaskStatus,
  UserStatus,
  UserType,
} from '../common/enums';
import { PeriodSchedule, TaskSchedule } from '../common/types/gst-schedule';
import { SchedulingService } from '../schedule/scheduling.service';

interface DesiredTask {
  category: ComplianceCategory;
  due_date: Date;
}

@Injectable()
export class ComplianceTasksService {
  constructor(
    @InjectRepository(ComplianceTask)
    private readonly tasksRepository: Repository<ComplianceTask>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(GstFilingPeriod)
    private readonly periodsRepository: Repository<GstFilingPeriod>,
    private readonly scheduling: SchedulingService,
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
}

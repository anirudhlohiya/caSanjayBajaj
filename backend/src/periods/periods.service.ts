import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { SchedulingService } from '../schedule/scheduling.service';
import { ComplianceTasksService } from '../compliance-tasks/compliance-tasks.service';
import { CreatePeriodDto, UpdatePeriodDto } from './dto/period.dto';

@Injectable()
export class PeriodsService {
  private readonly logger = new Logger(PeriodsService.name);

  constructor(
    @InjectRepository(GstFilingPeriod)
    private readonly periods: Repository<GstFilingPeriod>,
    private readonly scheduling: SchedulingService,
    private readonly tasks: ComplianceTasksService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  list(): Promise<GstFilingPeriod[]> {
    return this.periods.find({ order: { period_code: 'DESC' } });
  }

  async listOpen(): Promise<GstFilingPeriod[]> {
    return this.periods.find({
      where: { is_open: true },
      order: { period_code: 'DESC' },
    });
  }

  async create(dto: CreatePeriodDto): Promise<GstFilingPeriod> {
    const exists = await this.periods.findOneBy({
      period_code: dto.period_code,
    });
    if (exists) throw new BadRequestException('Period code already exists');

    // Default hook (docs/13 §6.3): generate the schedule from the rules when
    // the caller did not supply one; validate any caller-supplied override.
    let schedule = dto.schedule ?? null;
    if (dto.schedule) {
      const problems = this.scheduling.validateSchedule(
        dto.period_code,
        dto.schedule,
      );
      if (problems.length > 0) {
        throw new BadRequestException(
          `Invalid schedule: ${problems.join('; ')}`,
        );
      }
    } else {
      schedule = this.scheduling.defaultScheduleForPeriodCode(dto.period_code);
    }

    const period = this.periods.create({
      ...dto,
      schedule,
    });
    return this.periods.save(period);
  }

  async findOne(id: string): Promise<GstFilingPeriod> {
    const period = await this.periods.findOneBy({ id });
    if (!period) throw new NotFoundException('Filing period not found');
    return period;
  }

  /**
   * Admin edit of a period (docs/13 §3.3 / §8). Deadline and reminder-date
   * overrides are stored on the row; any schedule change is written to the
   * audit log (§11.7).
   */
  async update(
    id: string,
    dto: UpdatePeriodDto,
    adminId: string,
  ): Promise<GstFilingPeriod> {
    const period = await this.findOne(id);

    const schedule = dto.schedule ?? null;
    if (dto.schedule) {
      const problems = this.scheduling.validateSchedule(
        period.period_code,
        dto.schedule,
      );
      if (problems.length > 0) {
        throw new BadRequestException(
          `Invalid schedule: ${problems.join('; ')}`,
        );
      }
    }

    const previous = {
      period_label: period.period_label,
      due_date: period.due_date,
      is_open: period.is_open,
      schedule: period.schedule,
    };

    if (schedule) period.schedule = schedule;
    if (dto.period_label !== undefined) period.period_label = dto.period_label;
    if (dto.due_date !== undefined) period.due_date = dto.due_date;
    if (dto.is_open !== undefined) period.is_open = dto.is_open;

    const saved = await this.periods.save(period);

    const changed = [
      previous.period_label !== saved.period_label && 'period_label',
      previous.due_date != null &&
        previous.due_date !== saved.due_date &&
        'due_date',
      previous.is_open !== saved.is_open && 'is_open',
      JSON.stringify(previous.schedule) !== JSON.stringify(saved.schedule) &&
        'schedule',
    ].filter(Boolean) as string[];

    if (changed.length > 0) {
      await this.audit.log(
        adminId,
        'period.schedule_updated',
        { period_code: saved.period_code, changed },
        { period_id: saved.id },
      );
    }

    return saved;
  }

  /**
   * Ensure the current month and the next `prefetch` months exist, each with a
   * default schedule. Existing periods (including admin overrides) are left
   * untouched. Returns the periods sorted newest-first.
   */
  async ensurePeriods(): Promise<GstFilingPeriod[]> {
    const prefetch = this.config.get<number>('autoCreatePeriods.prefetch') ?? 2;
    const now = new Date();

    for (let offset = 0; offset <= prefetch; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const periodCode = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const existing = await this.periods.findOneBy({
        period_code: periodCode,
      });
      if (existing) continue;

      const schedule = this.scheduling.defaultScheduleForPeriodCode(periodCode);
      await this.periods.save(
        this.periods.create({
          period_label: SchedulingService.periodLabel(periodCode),
          period_code: periodCode,
          due_date: schedule.gstr1.due,
          is_open: true,
          schedule,
        }),
      );
      this.logger.log(`Auto-created filing period ${periodCode}`);
    }

    return this.periods.find({ order: { period_code: 'DESC' } });
  }

  private currentPeriodCode(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Monthly rollover (docs/13 §5.1): ensure upcoming periods exist, then
   * (idempotently) generate this month's compliance tasks for every active GST
   * client per their cadence.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleMonthRollover(): Promise<void> {
    if (this.config.get('nodeEnv') === 'test') return;

    await this.ensurePeriods();
    const current = await this.periods.findOneBy({
      period_code: this.currentPeriodCode(),
    });
    if (!current) {
      this.logger.warn('Rollover: no current period found after ensure');
      return;
    }

    const generated = await this.tasks.generateAllForPeriod(current.id);
    this.logger.log(
      `Rollover for ${current.period_label}: ensured tasks for ${generated} clients`,
    );
  }
}

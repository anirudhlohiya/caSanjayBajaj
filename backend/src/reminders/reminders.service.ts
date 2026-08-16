import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { paginate, PaginatedResult } from '../common/dto/pagination';
import { ReminderChannel, ReminderStatus } from '../common/enums';
import { Document } from '../entities/document.entity';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { Reminder } from '../entities/reminder.entity';
import {
  NotificationsService,
  isPushSubscription,
} from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { ReminderLogQueryDto, SendReminderDto } from './dto/reminder.dto';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @InjectRepository(Reminder)
    private readonly reminders: Repository<Reminder>,
    @InjectRepository(GstFilingPeriod)
    private readonly periods: Repository<GstFilingPeriod>,
    @InjectRepository(Document)
    private readonly documents: Repository<Document>,
    private readonly notifications: NotificationsService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

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

  // ----- Scheduled job: auto reminders -----

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleAutoReminders(): Promise<void> {
    if (this.config.get('nodeEnv') === 'test') return;
    const leadDays = this.config.get<number>('reminders.leadDays') ?? 5;

    const leadDate = new Date();
    leadDate.setDate(leadDate.getDate() + leadDays);
    const leadDateStr = leadDate.toISOString().slice(0, 10);

    const periods = await this.periods.find({
      where: { is_open: true },
    });
    const dueSoon = periods.filter((p) => p.due_date <= leadDateStr);

    for (const period of dueSoon) {
      const result = await this.sendReminder(null, {
        filing_period_id: period.id,
        all_unfiled: true,
        channels: [ReminderChannel.PUSH, ReminderChannel.EMAIL],
      });
      this.logger.log(
        `Auto reminders for ${period.period_label}: ${result.sent}/${result.total}`,
      );
    }
  }
}

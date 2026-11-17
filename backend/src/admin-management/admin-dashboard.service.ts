import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { DocumentStatus, ReminderStatus, UserStatus } from '../common/enums';
import { adminCan } from '../common/guards/roles.guard';
import { AdminManagementService } from './admin-management.service';
import { Document } from '../entities/document.entity';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { Reminder } from '../entities/reminder.entity';
import { Report } from '../entities/report.entity';
import { User } from '../entities/user.entity';

/** The last six months as YYYY-MM, oldest first, with a count for each (0 when missing). */
export function lastSixMonths(
  rows: { month: string; count: number }[],
  now = new Date(),
): { month: string; count: number }[] {
  const byMonth = new Map(rows.map((r) => [r.month, Number(r.count)]));
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { month, count: byMonth.get(month) ?? 0 };
  });
}

type RecentActivityItem = {
  type: 'document' | 'report' | 'reminder';
  client_name: string;
  action: string;
  status: string;
  created_at: string;
};

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Document)
    private readonly documents: Repository<Document>,
    @InjectRepository(Report)
    private readonly reports: Repository<Report>,
    @InjectRepository(Reminder)
    private readonly reminders: Repository<Reminder>,
    @InjectRepository(GstFilingPeriod)
    private readonly periods: Repository<GstFilingPeriod>,
    private readonly adminManagement: AdminManagementService,
  ) {}

  me(adminId: string) {
    return this.adminManagement.findOne(adminId);
  }

  /** Each figure is null unless the admin may open the page it comes from. */
  async getStats(auth: AuthUser) {
    const clients = adminCan(auth, 'view_clients');
    const docs = adminCan(auth, 'view_documents');
    const reports = adminCan(auth, 'view_reports');
    const reminders = adminCan(auth, 'send_reminders');
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      total_clients,
      active_clients,
      documents_received,
      documents_processed,
      reports_total,
      reports_this_month,
      reminders_sent_total,
      open_periods,
    ] = await Promise.all([
      clients ? this.users.count() : null,
      clients
        ? this.users.count({ where: { status: UserStatus.ACTIVE } })
        : null,
      docs
        ? this.documents.count({ where: { status: DocumentStatus.RECEIVED } })
        : null,
      docs
        ? this.documents.count({ where: { status: DocumentStatus.PROCESSED } })
        : null,
      reports ? this.reports.count() : null,
      reports
        ? this.reports.count({
            where: { sent_at: MoreThanOrEqual(startOfMonth) },
          })
        : null,
      reminders
        ? this.reminders.count({ where: { status: ReminderStatus.SENT } })
        : null,
      this.periods.count({ where: { is_open: true } }),
    ]);

    const upcoming_due_dates = await this.periods.find({
      where: { is_open: true },
      order: { due_date: 'ASC' },
      take: 5,
    });

    // Dashboard chart: documents received per month (India time), last six months.
    const documents_by_month = docs
      ? lastSixMonths(
          await this.documents
            .createQueryBuilder('d')
            .select(
              "to_char(d.uploaded_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM')",
              'month',
            )
            .addSelect('COUNT(*)::int', 'count')
            .where('d.uploaded_at >= :since', {
              since: new Date(now.getFullYear(), now.getMonth() - 6, 1),
            })
            .groupBy('1')
            .getRawMany<{ month: string; count: number }>(),
          now,
        )
      : null;

    const recent_activity = await this.buildRecentActivity({
      docs,
      reports,
      reminders,
    });

    return {
      total_clients,
      active_clients,
      documents_received,
      documents_processed,
      reports_total,
      reports_this_month,
      reminders_sent_total,
      open_periods,
      upcoming_due_dates,
      recent_activity,
      documents_by_month,
    };
  }

  private async buildRecentActivity(can: {
    docs: boolean;
    reports: boolean;
    reminders: boolean;
  }): Promise<RecentActivityItem[]> {
    const [docs, reports, reminders] = await Promise.all([
      can.docs
        ? this.documents.find({
            relations: { user: true, filing_period: true },
            order: { uploaded_at: 'DESC' },
            take: 12,
          })
        : ([] as Document[]),
      can.reports
        ? this.reports.find({
            relations: { user: true, filing_period: true },
            order: { sent_at: 'DESC' },
            take: 12,
          })
        : ([] as Report[]),
      can.reminders
        ? this.reminders.find({
            relations: { user: true, filing_period: true },
            order: { created_at: 'DESC' },
            take: 12,
          })
        : ([] as Reminder[]),
    ]);

    const items: RecentActivityItem[] = [
      ...docs.map((d) => ({
        type: 'document' as const,
        client_name: d.user?.name ?? 'Unknown client',
        action: `Document uploaded: ${d.original_filename}`,
        status: d.status,
        created_at: d.uploaded_at.toISOString(),
      })),
      ...reports.map((r) => ({
        type: 'report' as const,
        client_name: r.user?.name ?? 'Unknown client',
        action: `${r.report_type.replace('_', ' ').toUpperCase()} report sent`,
        status: 'sent',
        created_at: r.sent_at.toISOString(),
      })),
      ...reminders.map((rm) => ({
        type: 'reminder' as const,
        client_name: rm.user?.name ?? 'Unknown client',
        action: `Reminder sent (${rm.channel})`,
        status: rm.status,
        created_at: rm.created_at.toISOString(),
      })),
    ];

    return items
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 12);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { DocumentStatus, ReminderStatus, UserStatus } from '../common/enums';
import { AdminManagementService } from './admin-management.service';
import { Document } from '../entities/document.entity';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { Reminder } from '../entities/reminder.entity';
import { Report } from '../entities/report.entity';
import { User } from '../entities/user.entity';

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

  async getStats() {
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
      this.users.count(),
      this.users.count({ where: { status: UserStatus.ACTIVE } }),
      this.documents.count({ where: { status: DocumentStatus.RECEIVED } }),
      this.documents.count({ where: { status: DocumentStatus.PROCESSED } }),
      this.reports.count(),
      this.reports.count({
        where: { sent_at: MoreThanOrEqual(startOfMonth) },
      }),
      this.reminders.count({ where: { status: ReminderStatus.SENT } }),
      this.periods.count({ where: { is_open: true } }),
    ]);

    const upcoming_due_dates = await this.periods.find({
      where: { is_open: true },
      order: { due_date: 'ASC' },
      take: 5,
    });

    const recent_activity = await this.buildRecentActivity();

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
    };
  }

  private async buildRecentActivity(): Promise<RecentActivityItem[]> {
    const [docs, reports, reminders] = await Promise.all([
      this.documents.find({
        relations: { user: true, filing_period: true },
        order: { uploaded_at: 'DESC' },
        take: 12,
      }),
      this.reports.find({
        relations: { user: true, filing_period: true },
        order: { sent_at: 'DESC' },
        take: 12,
      }),
      this.reminders.find({
        relations: { user: true, filing_period: true },
        order: { created_at: 'DESC' },
        take: 12,
      }),
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

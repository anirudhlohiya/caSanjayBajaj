import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import {
  DashboardService,
  ReportRequestsService,
  ServiceRequestsAdminService,
} from '../../core/services/feature.services';
import { DashboardStats } from '../../core/models';
import { StatusChip } from '../../shared/components/status-chip';
import { Spinner } from '../../shared/components/spinner';
import { PageHeader } from '../../shared/components/page-header';
import { EmptyState } from '../../shared/components/empty-state';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe, RouterLink, StatusChip, Spinner, PageHeader, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  private readonly dashboard = inject(DashboardService);
  private readonly serviceRequests = inject(ServiceRequestsAdminService);
  private readonly reportRequests = inject(ReportRequestsService);
  readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly adminName = signal('');
  readonly stats = signal<DashboardStats | null>(null);
  /** Client applications and report-copy requests nobody has handled yet. */
  readonly waiting = signal<{ id: string; client: string; text: string; date: string; userId: string }[]>([]);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [me, stats, apps, copies] = await Promise.all([
        this.dashboard.me(),
        this.dashboard.stats(),
        this.auth.hasPermission('view_clients') ? this.serviceRequests.listPending().catch(() => []) : [],
        this.auth.hasPermission('view_reports')
          ? this.reportRequests.adminList({ status: 'pending', pageSize: 50 }).then((r) => r.items).catch(() => [])
          : [],
      ]);
      this.adminName.set(me.name);
      this.stats.set(stats);
      this.waiting.set(
        [
          ...apps.map((r) => ({
            id: r.id,
            client: r.user?.name ?? 'Client',
            text: `Applied for ${{ gst: 'GST', itr: 'ITR', both: 'GST + ITR' }[r.requested_type]} service`,
            date: r.created_at,
            userId: r.user_id,
          })),
          ...copies.map((r) => ({
            id: r.id,
            client: r.user?.name ?? 'Client',
            text: `Asked for a report copy · ${r.filing_period?.period_label ?? ''}`,
            date: r.created_at,
            userId: r.user_id,
          })),
        ].sort((a, b) => a.date.localeCompare(b.date)),
      );
    } finally {
      this.loading.set(false);
    }
  }

  /** Bars for the "Documents received" chart: height as % of the busiest month, short month label. */
  readonly bars = computed(() => {
    const months = this.stats()?.documents_by_month ?? [];
    const max = Math.max(1, ...months.map((m) => m.count));
    return months.map((m) => ({
      count: m.count,
      pct: Math.max(4, Math.round((m.count / max) * 85)), // headroom for the count label
      label: new Date(m.month + '-01T00:00:00').toLocaleString('en-IN', { month: 'short' }),
    }));
  });

  readonly chartLabel = computed(
    () => 'Documents received per month: ' + this.bars().map((b) => `${b.label} ${b.count}`).join(', '),
  );

  fmt(n: number | null): string {
    return (n ?? 0).toLocaleString('en-IN');
  }

  /** Whole days from today to the due date (negative = overdue). */
  daysLeft(due: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(due.slice(0, 10) + 'T00:00:00');
    return Math.round((d.getTime() - today.getTime()) / 86_400_000);
  }
}
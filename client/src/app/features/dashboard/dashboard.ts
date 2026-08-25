import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import {
  DashboardService,
} from '../../core/services/feature.services';
import {
  Document,
  GstFilingPeriod,
  Report,
} from '../../core/models';
import { StatusChip } from '../../shared/components/status-chip';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, StatusChip, Spinner, EmptyState, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  private readonly dashboard = inject(DashboardService);
  readonly router = inject(Router);

  readonly loading = signal(true);
  readonly pendingDocs = signal<Document[]>([]);
  readonly latestReport = signal<Report | null>(null);
  readonly openPeriods = signal<GstFilingPeriod[]>([]);
  readonly unreadCount = signal(0);
  readonly notifDenied = signal(false);
  readonly notifDefault = signal(false);

  constructor() {
    void this.load();
    if ('Notification' in window) {
      this.notifDenied.set(Notification.permission === 'denied');
      this.notifDefault.set(Notification.permission === 'default');
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [pending, reports, periods, unread] = await Promise.all([
        this.dashboard.pendingDocuments(),
        this.dashboard.latestReports(),
        this.dashboard.listOpenPeriods(),
        this.dashboard.unreadNotifications(),
      ]);
      this.pendingDocs.set(pending.items);
      this.latestReport.set(reports.items[0] ?? null);
      this.openPeriods.set(periods);
      this.unreadCount.set(unread.total);
    } finally {
      this.loading.set(false);
    }
  }

  firstName(): string {
    const name = this.auth.userProfile()?.name;
    return name?.split(' ')[0] ?? 'there';
  }

  periodLabel(period?: GstFilingPeriod | null): string {
    return period?.period_label ?? '—';
  }

  fileSize(bytes: string): string {
    const n = Number(bytes);
    if (Number.isNaN(n)) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }
}
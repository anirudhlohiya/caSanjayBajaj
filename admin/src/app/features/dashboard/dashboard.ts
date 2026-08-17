import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DashboardService } from '../../core/services/feature.services';
import { DashboardStats } from '../../core/models';
import { StatusChip } from '../../shared/components/status-chip';
import { Spinner } from '../../shared/components/spinner';
import { PageHeader } from '../../shared/components/page-header';
import { EmptyState } from '../../shared/components/empty-state';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe, StatusChip, Spinner, PageHeader, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  private readonly dashboard = inject(DashboardService);

  readonly loading = signal(true);
  readonly adminName = signal('');
  readonly stats = signal<DashboardStats | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [me, stats] = await Promise.all([this.dashboard.me(), this.dashboard.stats()]);
      this.adminName.set(me.name);
      this.stats.set(stats);
    } finally {
      this.loading.set(false);
    }
  }

  fmt(n: number): string {
    return n.toLocaleString('en-IN');
  }
}
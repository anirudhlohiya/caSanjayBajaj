import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../core/services/toast.service';
import { PeriodsService, ReportsService } from '../../core/services/feature.services';
import { GstFilingPeriod, Report, REPORT_TYPE_LABELS } from '../../core/models';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [Spinner, EmptyState, DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports.html',
})
export class Reports {
  private readonly reportsService = inject(ReportsService);
  private readonly periodsService = inject(PeriodsService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly reports = signal<Report[]>([]);
  readonly periods = signal<GstFilingPeriod[]>([]);
  readonly periodId = signal('');
  readonly downloading = signal<string | null>(null);

  readonly total = computed(() => this.reports().length);

  constructor() {
    void this.init();
  }

  async init(): Promise<void> {
    try {
      const periods = await this.periodsService.list();
      this.periods.set(periods);
    } catch {
      /* non-fatal */
    }
    await this.load();
  }

  async setPeriod(id: string): Promise<void> {
    this.periodId.set(id);
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.reportsService.list({
        filingPeriodId: this.periodId() || undefined,
        pageSize: 100,
      });
      this.reports.set(result.items);
    } catch {
      this.reports.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  periodLabel(period?: GstFilingPeriod | null): string {
    return period?.period_label ?? '—';
  }

  typeLabel(report: Report): string {
    return REPORT_TYPE_LABELS[report.report_type] ?? report.report_type;
  }

  async download(report: Report): Promise<void> {
    this.downloading.set(report.id);
    try {
      const { download_url } = await this.reportsService.downloadUrl(report.id);
      window.open(download_url, '_blank');
    } catch {
      this.toast.error('Could not open this report right now.');
    } finally {
      this.downloading.set(null);
    }
  }
}
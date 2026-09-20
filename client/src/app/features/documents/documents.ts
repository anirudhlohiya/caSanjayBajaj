import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import {
  DocumentsService,
  PeriodsService,
  ComplianceTasksService,
  ComplianceTask,
  ReportRequestsService,
  ReportsService,
} from '../../core/services/feature.services';
import {
  Document,
  GstFilingPeriod,
  REPORT_TYPE_LABELS,
  Report,
} from '../../core/models';

const UPLOAD_CATEGORIES = ['gstr_1', 'gstr_3b', 'iff'];
const NIL_CATEGORIES = ['gstr_1', 'iff'];

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documents.html',
})
export class Documents {
  private readonly documentsService = inject(DocumentsService);
  private readonly periodsService = inject(PeriodsService);
  private readonly tasksService = inject(ComplianceTasksService);
  private readonly reportReqsService = inject(ReportRequestsService);
  private readonly reportsService = inject(ReportsService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly loading = signal(true);
  readonly docs = signal<Document[]>([]);
  readonly total = signal(0);
  readonly filter = signal('');
  readonly periods = signal<GstFilingPeriod[]>([]);
  readonly periodId = signal('');
  readonly tasks = signal<ComplianceTask[]>([]);
  readonly reports = signal<Report[]>([]);
  readonly selectedDoc = signal<Document | null>(null);
  readonly downloading = signal(false);
  readonly page = signal(1);
  readonly pageSize = 20;

  reportPeriodId = '';

  readonly filteredLabel = computed(() => {
    const f = this.filter();
    return f ? f.replace(/^\w/, (c) => c.toUpperCase()) : 'All';
  });

  readonly totalPages = computed(() => Math.ceil(this.total() / this.pageSize));

  readonly filterChips = [
    { key: '', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'received', label: 'Received' },
    { key: 'processed', label: 'Processed' },
  ];

  readonly cadence = computed(
    () => this.authService.userProfile()?.gst_filing_frequency ?? 'monthly',
  );

  readonly currentPeriod = computed(() => {
    const pid = this.periodId();
    if (pid) {
      const match = this.periods().find((p) => p.id === pid);
      if (match) return match;
    }
    return this.periods()[0];
  });

  /** Tasks that need a document upload (every category except GST payment). */
  readonly uploadTasks = computed(() =>
    this.tasks().filter((t) => UPLOAD_CATEGORIES.includes(t.category)),
  );

  /** GST payment is info-only — no upload required (docs/13 §3.3). */
  readonly paymentTask = computed(() =>
    this.tasks().find((t) => t.category === 'gst_payment'),
  );

  readonly docTotal = computed(() => this.uploadTasks().length);

  readonly docDone = computed(
    () =>
      this.uploadTasks().filter(
        (t) => t.status === 'completed' || t.status === 'uploaded',
      ).length,
  );

  readonly progressPct = computed(() => {
    const total = this.docTotal();
    if (!total) return 0;
    return Math.round((this.docDone() / total) * 100);
  });

  constructor() {
    const initial = this.route.snapshot.queryParamMap.get('period');
    if (initial) this.periodId.set(initial);
    void this.init();
  }

  async init(): Promise<void> {
    try {
      const periods = await this.periodsService.list();
      this.periods.set(periods);
      if (periods.length > 0) {
        if (!this.periodId()) this.periodId.set(periods[0].id);
        this.reportPeriodId = periods[0].id;
      }
    } catch {
      /* non-fatal */
    }
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const pid = this.periodId();
      const [tasks, reportsRes] = await Promise.all([
        pid ? this.tasksService.list(pid) : Promise.resolve<ComplianceTask[]>([]),
        this.reportsService.list({
          filingPeriodId: pid || undefined,
          pageSize: 100,
        }),
      ]);
      this.tasks.set(tasks);
      this.reports.set(reportsRes.items);
    } catch {
      this.tasks.set([]);
      this.reports.set([]);
      this.docs.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async setFilter(key: string): Promise<void> {
    this.filter.set(key);
    this.page.set(1);
    await this.load();
  }

  async setPeriod(id: string): Promise<void> {
    this.periodId.set(id);
    this.page.set(1);
    await this.load();
  }

  async nextPage(): Promise<void> {
    if (this.page() * this.pageSize >= this.total()) return;
    this.page.set(this.page() + 1);
    await this.load();
  }

  async prevPage(): Promise<void> {
    if (this.page() <= 1) return;
    this.page.set(this.page() - 1);
    await this.load();
  }

  goUpload(): void {
    void this.router.navigate(['/upload']);
  }

  canFileNil(task: ComplianceTask): boolean {
    return NIL_CATEGORIES.includes(task.category);
  }

  async markNil(task: ComplianceTask): Promise<void> {
    try {
      await this.tasksService.markNil(task.id);
      this.toast.success('Declared Nil. Pending CA confirmation.');
      await this.load();
    } catch {
      this.toast.error('Failed to declare Nil');
    }
  }

  async requestReport(): Promise<void> {
    if (!this.reportPeriodId) {
      this.toast.error('Please select a period');
      return;
    }
    try {
      await this.reportReqsService.create(this.reportPeriodId);
      this.toast.success('Report requested successfully');
      await this.load();
    } catch {
      this.toast.error('Failed to request report');
    }
  }

  typeLabel(report: Report): string {
    return REPORT_TYPE_LABELS[report.report_type] ?? report.report_type;
  }

  async downloadReport(report: Report): Promise<void> {
    this.downloading.set(true);
    try {
      const { download_url } = await this.reportsService.downloadUrl(report.id);
      window.open(download_url, '_blank');
    } catch {
      this.toast.error('Could not open this report right now.');
    } finally {
      this.downloading.set(false);
    }
  }

  taskLabel(task: ComplianceTask): string {
    switch (task.category) {
      case 'gstr_1':
        return 'GSTR-1';
      case 'gstr_3b':
        return 'GSTR-3B';
      case 'iff':
        return 'IFF';
      case 'gst_payment':
        return 'GST Payment';
      default:
        return task.category.replace('_', ' ');
    }
  }

  periodLabel(period?: GstFilingPeriod | null): string {
    return period?.period_label ?? '—';
  }
}
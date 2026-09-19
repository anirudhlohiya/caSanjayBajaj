import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ToastService } from '../../core/services/toast.service';
import { DocumentsService, PeriodsService, ComplianceTasksService, ComplianceTask, ReportRequestsService } from '../../core/services/feature.services';
import { Document, GstFilingPeriod } from '../../core/models';

const FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'received', label: 'Received' },
  { key: 'processed', label: 'Processed' },
];

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documents.html',
})
export class Documents {
  private readonly documentsService = inject(DocumentsService);
  private readonly periodsService = inject(PeriodsService);
  private readonly tasksService = inject(ComplianceTasksService);
  private readonly reportReqsService = inject(ReportRequestsService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly docs = signal<Document[]>([]);
  readonly total = signal(0);
  readonly filter = signal('');
  readonly periods = signal<GstFilingPeriod[]>([]);
  readonly periodId = signal('');
  readonly tasks = signal<ComplianceTask[]>([]);
  readonly selectedDoc = signal<Document | null>(null);
  readonly downloading = signal(false);
  readonly page = signal(1);
  readonly pageSize = 20;

  reportPeriodId = '';

  uploadFiles(): void {
    this.toast.info('Upload files flow coming soon');
  }

  async requestReport(): Promise<void> {
    if (!this.reportPeriodId) {
      this.toast.error('Please select a period');
      return;
    }
    try {
      await this.reportReqsService.create(this.reportPeriodId);
      this.toast.success('Report requested successfully');
    } catch {
      this.toast.error('Failed to request report');
    }
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

  readonly filteredLabel = computed(() => {
    const f = this.filter();
    return f ? f.replace(/^\w/, (c) => c.toUpperCase()) : 'All';
  });

  readonly totalPages = computed(() => Math.ceil(this.total() / this.pageSize));

  readonly filterChips = FILTERS;

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
      if (pid) {
        const result = await this.tasksService.list(pid);
        this.tasks.set(result);
      } else {
        this.tasks.set([]);
      }
    } catch {
      this.tasks.set([]);
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

  selectDoc(doc: Document): void {
    this.selectedDoc.set(doc);
  }

  closeDoc(): void {
    this.selectedDoc.set(null);
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

  fileIcon(doc: Document): string {
    if (doc.file_type === 'image') return 'image';
    if (doc.file_type === 'excel') return 'table_chart';
    return 'picture_as_pdf';
  }

  async download(doc: Document): Promise<void> {
    this.downloading.set(true);
    try {
      const { download_url } = await this.documentsService.downloadUrl(doc.id);
      window.open(download_url, '_blank');
    } catch {
      this.toast.error('Could not open this document right now.');
    } finally {
      this.downloading.set(false);
    }
  }
}
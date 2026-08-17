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
import { DocumentsService, PeriodsService } from '../../core/services/feature.services';
import { Document, GstFilingPeriod } from '../../core/models';
import { StatusChip } from '../../shared/components/status-chip';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

const FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'received', label: 'Received' },
  { key: 'processed', label: 'Processed' },
];

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [StatusChip, Spinner, EmptyState, DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documents.html',
})
export class Documents {
  private readonly documentsService = inject(DocumentsService);
  private readonly periodsService = inject(PeriodsService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly docs = signal<Document[]>([]);
  readonly total = signal(0);
  readonly filter = signal('');
  readonly periods = signal<GstFilingPeriod[]>([]);
  readonly periodId = signal('');
  readonly selectedDoc = signal<Document | null>(null);
  readonly downloading = signal(false);
  readonly page = signal(1);
  readonly pageSize = 20;

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
    } catch {
      /* non-fatal */
    }
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.documentsService.list({
        status: this.filter() || undefined,
        filingPeriodId: this.periodId() || undefined,
        page: this.page(),
        pageSize: this.pageSize,
      });
      this.docs.set(result.items);
      this.total.set(result.total);
    } catch {
      this.docs.set([]);
      this.total.set(0);
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
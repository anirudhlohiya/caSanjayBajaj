import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DocumentsService, PeriodsService } from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import { Document, FilingPeriod } from '../../core/models';
import { PageHeader } from '../../shared/components/page-header';
import { StatusChip } from '../../shared/components/status-chip';
import { Pagination } from '../../shared/components/pagination';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [PageHeader, StatusChip, Pagination, Spinner, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documents.html',
})
export class Documents implements OnInit {
  private readonly documentsService = inject(DocumentsService);
  private readonly periodsService = inject(PeriodsService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly docs = signal<Document[]>([]);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly statusFilter = signal('');
  readonly periodFilter = signal('');
  readonly periods = signal<FilingPeriod[]>([]);
  readonly processing = signal<string[]>([]);
  readonly downloading = signal<string[]>([]);

  ngOnInit(): void {
    void this.loadPeriods();
    void this.load();
  }

  async loadPeriods(): Promise<void> {
    try {
      this.periods.set(await this.periodsService.list());
    } catch {
      this.periods.set([]);
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.documentsService.adminList({
        page: this.page(),
        pageSize: this.pageSize(),
        status: this.statusFilter() || undefined,
        filing_period_id: this.periodFilter() || undefined,
      });
      this.docs.set(res.items);
      this.total.set(res.total);
      this.totalPages.set(res.totalPages);
    } finally {
      this.loading.set(false);
    }
  }

  applyFilters(): void {
    this.page.set(1);
    void this.load();
  }

  pageChanged(p: number): void {
    this.page.set(p);
    void this.load();
  }

  async download(doc: Document): Promise<void> {
    this.downloading.update((l) => [...l, doc.id]);
    try {
      const { download_url } = await this.documentsService.adminDownloadUrl(doc.id);
      window.open(download_url, '_blank');
    } finally {
      this.downloading.update((l) => l.filter((x) => x !== doc.id));
    }
  }

  async markProcessed(doc: Document): Promise<void> {
    this.processing.update((l) => [...l, doc.id]);
    try {
      await this.documentsService.markProcessed(doc.id);
      this.toast.success('Document marked as processed');
      await this.load();
    } finally {
      this.processing.update((l) => l.filter((x) => x !== doc.id));
    }
  }

  isProcessing(id: string): boolean {
    return this.processing().includes(id);
  }

  isDownloading(id: string): boolean {
    return this.downloading().includes(id);
  }

  fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  fmtBytes(size: string): string {
    const n = Number(size);
    if (!n) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log2(n) / 10), units.length - 1);
    return `${(n / 2 ** (10 * i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }
}
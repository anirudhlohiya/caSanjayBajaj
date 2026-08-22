import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ClientsService,
  DocumentsService,
  PeriodsService,
  ReportsService,
} from '../../core/services/feature.services';
import { UploadService } from '../../core/services/upload.service';
import { ToastService } from '../../core/services/toast.service';
import { Client, Document, FilingPeriod, Report } from '../../core/models';
import { PageHeader } from '../../shared/components/page-header';
import { StatusChip } from '../../shared/components/status-chip';
import { Pagination } from '../../shared/components/pagination';
import { Modal } from '../../shared/components/modal';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeader, StatusChip, Pagination, Modal, Spinner, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-detail.html',
})
export class ClientDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientsService = inject(ClientsService);
  private readonly documentsService = inject(DocumentsService);
  private readonly reportsService = inject(ReportsService);
  private readonly periodsService = inject(PeriodsService);
  private readonly upload = inject(UploadService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly client = signal<Client | null>(null);

  readonly docs = signal<Document[]>([]);
  readonly docTotal = signal(0);
  readonly docPage = signal(1);
  readonly docPages = signal(0);

  readonly reports = signal<Report[]>([]);
  readonly reportTotal = signal(0);
  readonly reportPage = signal(1);
  readonly reportPages = signal(0);

  readonly periods = signal<FilingPeriod[]>([]);
  readonly showReport = signal(false);
  readonly sending = signal(false);
  readonly processing = signal<string[]>([]);
  readonly downloading = signal<string[]>([]);

  private readonly id = signal('');

  readonly reportForm = this.fb.nonNullable.group({
    filing_period_id: ['', Validators.required],
    report_type: ['gstr_1'],
    file: [null as File | null, Validators.required],
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id') ?? '';
      this.id.set(id);
      void this.load();
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [client, docsRes, reportsRes, periods] = await Promise.all([
        this.clientsService.get(this.id()),
        this.documentsService.listForUser(this.id(), { page: this.docPage(), pageSize: 10 }),
        this.reportsService.listForUser(this.id(), { page: this.reportPage(), pageSize: 10 }),
        this.periodsService.open(),
      ]);
      this.client.set(client);
      this.docs.set(docsRes.items);
      this.docTotal.set(docsRes.total);
      this.docPages.set(docsRes.totalPages);
      this.reports.set(reportsRes.items);
      this.reportTotal.set(reportsRes.total);
      this.reportPages.set(reportsRes.totalPages);
      this.periods.set(periods);
      this.reportForm.controls.filing_period_id.setValue(periods[0]?.id ?? '');
    } finally {
      this.loading.set(false);
    }
  }

  docPageChanged(p: number): void {
    this.docPage.set(p);
    void this.load();
  }

  reportPageChanged(p: number): void {
    this.reportPage.set(p);
    void this.load();
  }

  async downloadDocument(doc: Document): Promise<void> {
    this.downloading.update((l) => [...l, doc.id]);
    try {
      const { download_url } = await this.documentsService.downloadUrl(doc.id);
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

  async downloadReport(report: Report): Promise<void> {
    this.downloading.update((l) => [...l, report.id]);
    try {
      const { download_url } = await this.reportsService.downloadUrl(report.id);
      window.open(download_url, '_blank');
    } finally {
      this.downloading.update((l) => l.filter((x) => x !== report.id));
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.reportForm.controls.file.setValue(input.files?.[0] ?? null);
  }

  async submitReport(): Promise<void> {
    const form = this.reportForm;
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    const file = form.controls.file.value;
    if (!file) return;
    this.sending.set(true);
    try {
      const { report_id, upload_url } = await this.reportsService.requestUploadUrl({
        user_id: this.id(),
        filing_period_id: form.controls.filing_period_id.value,
        report_type: form.controls.report_type.value,
        filename: file.name,
        contentType: file.type || 'application/pdf',
        file_size_bytes: file.size,
      });
      await this.upload.upload(upload_url, file, file.type || 'application/pdf');
      await this.reportsService.confirm(report_id);
      this.toast.success('Report uploaded and client notified');
      this.showReport.set(false);
      await this.load();
    } finally {
      this.sending.set(false);
    }
  }

  sendReminder(): void {
    void this.router.navigate(['/reminders'], { queryParams: { client: this.id() } });
  }

  fmtDate(iso: string | null): string {
    if (!iso) return '—';
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

  isProcessing(id: string): boolean {
    return this.processing().includes(id);
  }

  isDownloading(id: string): boolean {
    return this.downloading().includes(id);
  }
}
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  ClientsService,
  PeriodsService,
  ReportsService,
} from '../../core/services/feature.services';
import { UploadService } from '../../core/services/upload.service';
import { ToastService } from '../../core/services/toast.service';
import { Client, FilingPeriod, Report } from '../../core/models';
import { PageHeader } from '../../shared/components/page-header';
import { Pagination } from '../../shared/components/pagination';
import { Modal } from '../../shared/components/modal';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeader, Pagination, Modal, Spinner, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports.html',
})
export class Reports implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly clientsService = inject(ClientsService);
  private readonly periodsService = inject(PeriodsService);
  private readonly upload = inject(UploadService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly reports = signal<Report[]>([]);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly periodFilter = signal('');
  readonly typeFilter = signal('');
  readonly periods = signal<FilingPeriod[]>([]);
  readonly clients = signal<Client[]>([]);
  readonly showSend = signal(false);
  readonly sending = signal(false);
  readonly downloading = signal<string[]>([]);

  readonly sendForm = this.fb.nonNullable.group({
    user_id: ['', Validators.required],
    filing_period_id: ['', Validators.required],
    report_type: ['gstr_1'],
    file: [null as File | null, Validators.required],
  });

  ngOnInit(): void {
    void this.loadMeta();
    void this.load();
  }

  async loadMeta(): Promise<void> {
    try {
      const [periods, clients] = await Promise.all([
        this.periodsService.open(),
        this.clientsService.list(1, 100),
      ]);
      this.periods.set(periods);
      this.clients.set(clients.items.filter((c) => c.status === 'active'));
      this.sendForm.controls.filing_period_id.setValue(periods[0]?.id ?? '');
    } catch {
      this.periods.set([]);
      this.clients.set([]);
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.reportsService.adminList({
        page: this.page(),
        pageSize: this.pageSize(),
        filing_period_id: this.periodFilter() || undefined,
        report_type: this.typeFilter() || undefined,
      });
      this.reports.set(res.items);
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

  openSend(): void {
    this.sendForm.reset({ report_type: 'gstr_1' });
    this.sendForm.controls.filing_period_id.setValue(this.periods()[0]?.id ?? '');
    this.showSend.set(true);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.sendForm.controls.file.setValue(input.files?.[0] ?? null);
  }

  async submitSend(): Promise<void> {
    const form = this.sendForm;
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    const file = form.controls.file.value;
    if (!file) return;
    this.sending.set(true);
    try {
      const { report_id, upload_url } = await this.reportsService.requestUploadUrl({
        user_id: form.controls.user_id.value,
        filing_period_id: form.controls.filing_period_id.value,
        report_type: form.controls.report_type.value,
        filename: file.name,
        contentType: file.type || 'application/pdf',
        file_size_bytes: file.size,
      });
      await firstValueFrom(this.upload.upload(upload_url, file, file.type || 'application/pdf'));
      await this.reportsService.confirm(report_id);
      this.toast.success('Report uploaded and client notified');
      this.showSend.set(false);
      await this.load();
    } finally {
      this.sending.set(false);
    }
  }

  async download(report: Report): Promise<void> {
    this.downloading.update((l) => [...l, report.id]);
    try {
      const { download_url } = await this.reportsService.downloadUrl(report.id);
      window.open(download_url, '_blank');
    } finally {
      this.downloading.update((l) => l.filter((x) => x !== report.id));
    }
  }

  isDownloading(id: string): boolean {
    return this.downloading().includes(id);
  }

  reportTypeLabel(t: string): string {
    return t.replace('_', ' ').toUpperCase();
  }

  fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
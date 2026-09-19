import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ClientsService,
  CertificatesService,
  DocumentsService,
  PeriodsService,
  ReportsService,
  ComplianceTasksService,
  ComplianceTask,
  ReportRequestsService
} from '../../core/services/feature.services';
import { UploadService } from '../../core/services/upload.service';
import { ToastService } from '../../core/services/toast.service';
import { CertType, Client, ClientCertificate, Document, FilingPeriod, Report, ReportRequest } from '../../core/models';
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
  private readonly certificatesService = inject(CertificatesService);
  private readonly documentsService = inject(DocumentsService);
  private readonly reportsService = inject(ReportsService);
  private readonly periodsService = inject(PeriodsService);
  private readonly tasksService = inject(ComplianceTasksService);
  private readonly reportReqsService = inject(ReportRequestsService);
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

  readonly certificates = signal<ClientCertificate[]>([]);
  readonly reportRequests = signal<ReportRequest[]>([]);

  readonly periods = signal<FilingPeriod[]>([]);
  readonly tasks = signal<ComplianceTask[]>([]);
  readonly selectedPeriod = signal<string>('');

  readonly showReport = signal(false);
  readonly showCertUpload = signal(false);
  readonly sending = signal(false);
  readonly processing = signal<string[]>([]);
  readonly downloading = signal<string[]>([]);

  private readonly id = signal('');

  readonly reportForm = this.fb.nonNullable.group({
    filing_period_id: ['', Validators.required],
    report_type: ['gstr_1'],
    file: [null as File | null, Validators.required],
    report_request_id: [''],
  });

  readonly certForm = this.fb.nonNullable.group({
    cert_type: ['gst_cert' as CertType],
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
      const [client, docsRes, reportsRes, periods, certs, reqsRes] = await Promise.all([
        this.clientsService.get(this.id()),
        this.documentsService.listForUser(this.id(), { page: this.docPage(), pageSize: 10 }),
        this.reportsService.listForUser(this.id(), { page: this.reportPage(), pageSize: 10 }),
        this.periodsService.open(),
        this.certificatesService.listForClient(this.id()),
        this.reportReqsService.adminList({ status: 'pending' }) // Fetching only pending for now, or all if we want. Wait, adminList doesn't take user_id yet.
      ]);
      // Note: We'll filter the reqs on the frontend if the endpoint doesn't support user_id yet
      this.reportRequests.set(reqsRes.items.filter((r) => r.user_id === this.id()));
      this.client.set(client);
      this.docs.set(docsRes.items);
      this.docTotal.set(docsRes.total);
      this.docPages.set(docsRes.totalPages);
      this.reports.set(reportsRes.items);
      this.reportTotal.set(reportsRes.total);
      this.reportPages.set(reportsRes.totalPages);
      this.certificates.set(certs);
      this.periods.set(periods);
      const defaultPeriod = periods[0]?.id ?? '';
      this.selectedPeriod.set(defaultPeriod);
      this.reportForm.controls.filing_period_id.setValue(defaultPeriod);

      if (defaultPeriod) {
        await this.loadTasks(defaultPeriod);
      }
    } finally {
      this.loading.set(false);
    }
  }

  async loadTasks(periodId: string): Promise<void> {
    try {
      const tasks = await this.tasksService.listForClient(this.id(), periodId);
      this.tasks.set(tasks);
    } catch (e) {
      console.error(e);
    }
  }

  async generateTasks(): Promise<void> {
    try {
      const p = this.selectedPeriod();
      if (!p) return;
      const tasks = await this.tasksService.autoGenerateTasks(this.id(), p, false);
      this.tasks.set(tasks);
      this.toast.success('Checklist generated successfully');
    } catch (e) {
      console.error(e);
      this.toast.error('Failed to generate checklist');
    }
  }

  async confirmNil(task: ComplianceTask): Promise<void> {
    try {
      await this.tasksService.confirmNil(task.id);
      this.toast.success('Nil filing confirmed');
      await this.loadTasks(this.selectedPeriod());
    } catch (e) {
      console.error(e);
      this.toast.error('Failed to confirm Nil');
    }
  }

  async updatePayment(task: ComplianceTask, amount: string): Promise<void> {
    try {
      await this.tasksService.updatePayment(task.id, amount, '');
      this.toast.success('Payment updated');
      await this.loadTasks(this.selectedPeriod());
    } catch (e) {
      console.error(e);
      this.toast.error('Failed to update payment');
    }
  }

  fulfillRequest(req: ReportRequest): void {
    this.reportForm.patchValue({
      filing_period_id: req.filing_period_id,
      report_type: 'gstr_1',
      report_request_id: req.id,
    });
    this.showReport.set(true);
  }

  async markTaskPaid(task: ComplianceTask): Promise<void> {
    try {
      await this.tasksService.updatePayment(task.id, task.amount ?? '', new Date().toISOString());
      this.toast.success('Marked as paid. It will be updated shortly.');
      await this.loadTasks(this.selectedPeriod());
    } catch (e) {
      console.error(e);
      this.toast.error('Failed to mark as paid');
    }
  }

  onPeriodChange(event: Event): void {
    const sel = event.target as HTMLSelectElement;
    this.selectedPeriod.set(sel.value);
    void this.loadTasks(sel.value);
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

  onCertFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.certForm.controls.file.setValue(input.files?.[0] ?? null);
  }

  certFor(certType: CertType): ClientCertificate | undefined {
    return this.certificates().find((c) => c.cert_type === certType);
  }

  hasCert(certType: CertType): boolean {
    return !!this.certFor(certType);
  }

  openCertUpload(certType: CertType): void {
    this.certForm.controls.cert_type.setValue(certType);
    this.certForm.controls.file.setValue(null);
    this.showCertUpload.set(true);
  }

  async downloadCertificate(cert: ClientCertificate): Promise<void> {
    this.downloading.update((l) => [...l, cert.id]);
    try {
      const { download_url } = await this.certificatesService.downloadUrl(cert.id);
      window.open(download_url, '_blank');
    } finally {
      this.downloading.update((l) => l.filter((x) => x !== cert.id));
    }
  }

  async submitCertificate(): Promise<void> {
    const form = this.certForm;
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    const file = form.controls.file.value;
    if (!file) return;
    this.sending.set(true);
    try {
      const { certificate_id, upload_url } = await this.certificatesService.uploadUrl(
        this.id(),
        {
          cert_type: form.controls.cert_type.value,
          filename: file.name,
          contentType: file.type || 'application/pdf',
        },
      );
      await this.upload.upload(upload_url, file, file.type || 'application/pdf');
      await this.certificatesService.confirm(this.id(), certificate_id);
      this.toast.success('Certificate uploaded');
      this.showCertUpload.set(false);
      await this.load();
    } catch (e) {
      console.error(e);
      this.toast.error('Failed to upload certificate');
    } finally {
      this.sending.set(false);
    }
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
      const f = form.value;
      let report_id: string;
      let upload_url: string;

      if (f.report_request_id) {
        const res = await this.reportReqsService.fulfill(f.report_request_id, {
          filename: f.file!.name,
          contentType: f.file!.type,
          file_size_bytes: f.file!.size,
          report_type: f.report_type!,
        });
        report_id = res.report_id;
        upload_url = res.upload_url;
      } else {
        const res = await this.reportsService.requestUploadUrl({
          user_id: this.id(),
          filing_period_id: f.filing_period_id!,
          report_type: f.report_type!,
          filename: f.file!.name,
          contentType: f.file!.type,
          file_size_bytes: f.file!.size,
        });
        report_id = res.report_id;
        upload_url = res.upload_url;
      }

      await this.upload.upload(upload_url, f.file!, f.file!.type || 'application/pdf');
      this.toast.success(f.report_request_id ? 'Report request fulfilled' : 'Report sent successfully');
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
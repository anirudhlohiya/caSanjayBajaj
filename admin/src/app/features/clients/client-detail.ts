import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ClientsService,
  CertificatesService,
  DocumentsService,
  PeriodsService,
  ReportsService,
  ComplianceTasksService,
  ComplianceTask,
  ReportRequestsService,
  ServiceRequestsAdminService,
  ItrReturnsAdminService,
  FamilyMembersAdminService,
} from '../../core/services/feature.services';
import { UploadService } from '../../core/services/upload.service';
import { ToastService } from '../../core/services/toast.service';
import {
  CertType,
  Client,
  ClientCertificate,
  Document,
  FilingPeriod,
  FamilyMember,
  ItrReturn,
  Report,
  ReportRequest,
  ServiceRequest,
  UserType,
} from '../../core/models';
import { PageHeader } from '../../shared/components/page-header';
import { StatusChip } from '../../shared/components/status-chip';
import { Pagination } from '../../shared/components/pagination';
import { Modal } from '../../shared/components/modal';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';
import { INDUSTRIES } from '../../../../../shared/constants/industries';
import { isValidGstin, isValidPan } from '../../../../../shared/constants/tax-validation';
import {
  FAMILY_RELATIONS,
  MAX_FAMILY_MEMBERS,
  currentAssessmentYear,
  itrYearLabel,
  recentAssessmentYears,
} from '../../../../../shared/constants/itr-year';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    PageHeader,
    StatusChip,
    Pagination,
    Modal,
    Spinner,
    EmptyState,
  ],
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
  private readonly serviceRequestsAdmin = inject(ServiceRequestsAdminService);
  private readonly itrReturnsAdmin = inject(ItrReturnsAdminService);
  private readonly familyAdmin = inject(FamilyMembersAdminService);
  private readonly upload = inject(UploadService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly industries = INDUSTRIES;
  /** Current ITR year and the three before it (rolls over on 1 April). */
  readonly assessmentYears = recentAssessmentYears(4);
  readonly itrYearLabel = itrYearLabel;

  // --- Family members ---
  readonly familyMembers = signal<FamilyMember[]>([]);
  readonly relations = FAMILY_RELATIONS;
  readonly maxFamilyMembers = MAX_FAMILY_MEMBERS;
  readonly showMemberModal = signal(false);
  readonly memberSaving = signal(false);
  readonly editingMemberId = signal<string | null>(null);
  readonly memberForm = signal({ name: '', relation: 'spouse', pan: '' });

  readonly loading = signal(true);
  readonly client = signal<Client | null>(null);

  readonly pendingRequest = signal<ServiceRequest | null>(null);
  readonly itrReturns = signal<ItrReturn[]>([]);

  // Type change
  readonly showTypeChangeConfirm = signal(false);
  readonly selectedTypeToChange = signal<UserType>('general');
  readonly typeChangeSaving = signal(false);

  // Forms saving state
  readonly gstProfileSaving = signal(false);
  readonly itrProfileSaving = signal(false);
  readonly showItrUploadModal = signal(false);
  readonly itrUploadLoading = signal(false);

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
  readonly editingCadence = signal(false);
  readonly cadenceSaving = signal(false);

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

  readonly gstProfileForm = this.fb.group({
    business_name: [''],
    gstin: [''],
    gst_filing_frequency: ['monthly' as 'monthly' | 'quarterly'],
    industry: [''],
  });

  readonly itrProfileForm = this.fb.group({
    pan: [''],
  });

  readonly itrReturnForm = this.fb.group({
    assessment_year: [currentAssessmentYear(), Validators.required],
    /** '' = the account holder */
    family_member_id: [''],
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
      const [
        client,
        docsRes,
        reportsRes,
        periods,
        certs,
        reqsRes,
        pendingReqs,
        itrReturns,
      ] = await Promise.all([
        this.clientsService.get(this.id()),
        this.documentsService.listForUser(this.id(), {
          page: this.docPage(),
          pageSize: 10,
        }),
        this.reportsService.listForUser(this.id(), {
          page: this.reportPage(),
          pageSize: 10,
        }),
        this.periodsService.open(),
        this.certificatesService.listForClient(this.id()),
        this.reportReqsService.adminList({ status: 'pending' }),
        this.serviceRequestsAdmin.listPending().catch(() => []),
        this.itrReturnsAdmin.listForClient(this.id()).catch(() => []),
      ]);
      this.familyMembers.set(await this.familyAdmin.list(this.id()).catch(() => []));

      this.client.set(client);
      this.selectedTypeToChange.set(client.user_type);
      this.gstProfileForm.patchValue({
        business_name: client.business_name ?? '',
        gstin: client.gstin ?? '',
        gst_filing_frequency: client.gst_filing_frequency ?? 'monthly',
        industry: client.industry ?? '',
      });
      this.itrProfileForm.patchValue({
        pan: client.pan ?? '',
      });

      const userPending = pendingReqs.find((r) => r.user_id === this.id()) ?? null;
      this.pendingRequest.set(userPending);
      this.itrReturns.set(itrReturns);

      this.reportRequests.set(reqsRes.items.filter((r) => r.user_id === this.id()));
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

  // --- Services and Client Type Management ---

  onTypeSelectChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const val = select.value as UserType;
    if (val !== this.client()?.user_type) {
      this.selectedTypeToChange.set(val);
      this.showTypeChangeConfirm.set(true);
    }
  }

  cancelTypeChange(): void {
    this.showTypeChangeConfirm.set(false);
    if (this.client()) {
      this.selectedTypeToChange.set(this.client()!.user_type);
    }
  }

  async confirmDirectTypeChange(): Promise<void> {
    const newType = this.selectedTypeToChange();
    this.typeChangeSaving.set(true);
    try {
      await this.clientsService.changeType(this.id(), newType);
      this.toast.success(`Client type changed to ${newType.toUpperCase()}`);
      this.showTypeChangeConfirm.set(false);
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.message ?? 'Failed to change client type');
    } finally {
      this.typeChangeSaving.set(false);
    }
  }

  async approveServiceRequest(): Promise<void> {
    const req = this.pendingRequest();
    if (!req) return;
    try {
      await this.serviceRequestsAdmin.review(req.id, 'approve');
      this.toast.success('Service request approved successfully');
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.message ?? 'Failed to approve service request');
    }
  }

  async rejectServiceRequest(): Promise<void> {
    const req = this.pendingRequest();
    if (!req) return;
    const note = prompt('Reason for rejection (optional):') ?? undefined;
    try {
      await this.serviceRequestsAdmin.review(req.id, 'reject', note);
      this.toast.success('Service request rejected');
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.message ?? 'Failed to reject service request');
    }
  }

  // --- Profile Edits ---

  async saveGstProfile(): Promise<void> {
    const val = this.gstProfileForm.value;
    const gstin = val.gstin?.trim().toUpperCase() || undefined;
    if (gstin && !isValidGstin(gstin)) {
      this.toast.error('Invalid GSTIN format or checksum');
      return;
    }

    this.gstProfileSaving.set(true);
    try {
      await this.clientsService.update(this.id(), {
        business_name: val.business_name?.trim() || undefined,
        gstin: gstin || undefined,
        gst_filing_frequency: val.gst_filing_frequency ?? 'monthly',
        industry: val.industry?.trim() || undefined,
      });
      this.toast.success('GST profile saved successfully');
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.message ?? 'Failed to save GST profile');
    } finally {
      this.gstProfileSaving.set(false);
    }
  }

  async saveItrProfile(): Promise<void> {
    const val = this.itrProfileForm.value;
    const pan = val.pan?.trim().toUpperCase() || undefined;
    if (pan && !isValidPan(pan)) {
      this.toast.error('Invalid PAN format (expected ABCDE1234F)');
      return;
    }

    this.itrProfileSaving.set(true);
    try {
      await this.clientsService.update(this.id(), {
        pan: pan || undefined,
      });
      this.toast.success('ITR profile saved successfully');
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.message ?? 'Failed to save ITR profile');
    } finally {
      this.itrProfileSaving.set(false);
    }
  }

  // --- ITR Returns Upload ---

  openItrUpload(): void {
    this.itrReturnForm.reset({
      assessment_year: currentAssessmentYear(),
      family_member_id: '',
      file: null,
    });
    this.showItrUploadModal.set(true);
  }

  onItrReturnFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        this.toast.error('Only PDF files are accepted for ITR returns.');
        input.value = '';
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        this.toast.error('File size must not exceed 10 MB.');
        input.value = '';
        return;
      }
    }
    this.itrReturnForm.patchValue({ file });
  }

  async submitItrReturn(): Promise<void> {
    const form = this.itrReturnForm;
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    const file = form.controls.file.value;
    const ay = form.controls.assessment_year.value;
    const memberId = form.controls.family_member_id.value || undefined;
    if (!file || !ay) return;

    this.itrUploadLoading.set(true);
    try {
      const res = await this.itrReturnsAdmin.requestUploadUrl(this.id(), {
        assessment_year: ay,
        filename: file.name,
        contentType: 'application/pdf',
      });
      await this.upload.upload(res.upload_url, file, 'application/pdf');
      await this.itrReturnsAdmin.confirm(this.id(), {
        assessment_year: ay,
        family_member_id: memberId,
        s3_key: res.s3_key,
        filename: file.name,
        size: file.size,
      });
      this.toast.success(`${itrYearLabel(ay)} return uploaded for ${this.personName(memberId ?? null)}`);
      this.showItrUploadModal.set(false);
      const returns = await this.itrReturnsAdmin.listForClient(this.id());
      this.itrReturns.set(returns);
    } catch (e: any) {
      this.toast.error(e?.error?.message ?? 'Failed to upload ITR return');
    } finally {
      this.itrUploadLoading.set(false);
    }
  }

  /** Returns sorted holder first, then members, newest year first. */
  sortedItrReturns(): ItrReturn[] {
    const order = new Map(this.familyMembers().map((m, i) => [m.id, i + 1]));
    return [...this.itrReturns()].sort(
      (a, b) =>
        (order.get(a.family_member_id ?? '') ?? 0) - (order.get(b.family_member_id ?? '') ?? 0) ||
        b.assessment_year.localeCompare(a.assessment_year),
    );
  }

  personName(memberId: string | null): string {
    if (!memberId) return this.client()?.name ?? 'Account holder';
    return this.familyMembers().find((m) => m.id === memberId)?.name ?? 'Family member';
  }

  relationLabel(key: string): string {
    return FAMILY_RELATIONS.find((r) => r.key === key)?.label ?? key;
  }

  // --- Family members ---

  openMemberModal(member?: FamilyMember): void {
    this.editingMemberId.set(member?.id ?? null);
    this.memberForm.set({
      name: member?.name ?? '',
      relation: member?.relation ?? 'spouse',
      pan: member?.pan ?? '',
    });
    this.showMemberModal.set(true);
  }

  setMemberField(key: 'name' | 'relation' | 'pan', value: string): void {
    this.memberForm.update((f) => ({ ...f, [key]: key === 'pan' ? value.toUpperCase() : value }));
  }

  memberPanInvalid(): boolean {
    const pan = this.memberForm().pan.trim();
    return !!pan && !isValidPan(pan);
  }

  async saveMember(): Promise<void> {
    const f = this.memberForm();
    if (!f.name.trim() || this.memberPanInvalid() || this.memberSaving()) return;
    this.memberSaving.set(true);
    try {
      const body = { name: f.name.trim(), relation: f.relation, pan: f.pan.trim() };
      const id = this.editingMemberId();
      if (id) {
        await this.familyAdmin.update(this.id(), id, body);
        this.toast.success('Family member updated');
      } else {
        await this.familyAdmin.create(this.id(), body);
        this.toast.success('Family member added');
      }
      this.familyMembers.set(await this.familyAdmin.list(this.id()));
      this.showMemberModal.set(false);
    } catch (e: any) {
      this.toast.error(e?.error?.message ?? 'Could not save family member');
    } finally {
      this.memberSaving.set(false);
    }
  }

  async removeMember(member: FamilyMember): Promise<void> {
    const count = this.itrReturns().filter((r) => r.family_member_id === member.id).length;
    const extra = count
      ? ` Their ${count} ITR return${count > 1 ? 's' : ''} and uploaded documents will also be deleted.`
      : ' Their uploaded documents will also be deleted.';
    if (!confirm(`Remove ${member.name}?${extra}`)) return;
    await this.familyAdmin.remove(this.id(), member.id);
    this.familyMembers.update((list) => list.filter((m) => m.id !== member.id));
    this.itrReturns.update((list) => list.filter((r) => r.family_member_id !== member.id));
    this.toast.success(`${member.name} removed`);
  }

  downloadItrReturn(ret: ItrReturn): void {
    if (ret.downloadUrl) {
      window.open(ret.downloadUrl, '_blank');
    }
  }

  // --- Existing checklist, reports, certificates methods ---

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

  // --- Mark return filed (client alerted on in-app, push, email, WhatsApp) ---

  readonly filingTask = signal<ComplianceTask | null>(null);
  readonly filingArn = signal('');
  readonly filingFile = signal<File | null>(null);
  readonly filingSaving = signal(false);
  readonly reminding = signal<string[]>([]);
  readonly amountDrafts = signal<Record<string, string>>({});

  taskLabel(category: string): string {
    const labels: Record<string, string> = {
      gstr_1: 'GSTR-1',
      iff: 'IFF',
      gstr_3b: 'GSTR-3B',
      gst_payment: 'GST Payment',
    };
    return labels[category] ?? category.replace('_', ' ').toUpperCase();
  }

  canMarkFiled(t: ComplianceTask): boolean {
    return ['gstr_1', 'iff', 'gstr_3b'].includes(t.category) && !t.filed_at;
  }

  openMarkFiled(t: ComplianceTask): void {
    this.filingTask.set(t);
    this.filingArn.set('');
    this.filingFile.set(null);
  }

  onFilingFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.filingFile.set(input.files?.[0] ?? null);
  }

  async submitMarkFiled(): Promise<void> {
    const task = this.filingTask();
    if (!task) return;
    this.filingSaving.set(true);
    try {
      let reportId: string | undefined;
      const file = this.filingFile();
      if (file) {
        const res = await this.reportsService.requestUploadUrl({
          user_id: this.id(),
          filing_period_id: task.filing_period_id,
          report_type: task.category === 'gstr_3b' ? 'gstr_3b' : 'gstr_1',
          filename: file.name,
          contentType: file.type || 'application/pdf',
          file_size_bytes: file.size,
        });
        await this.upload.upload(res.upload_url, file, file.type || 'application/pdf');
        // The filed alert below carries the link, so skip the generic "report ready" alert
        await this.reportsService.confirm(res.report_id, false);
        reportId = res.report_id;
      }
      await this.tasksService.markFiled(task.id, {
        arn: this.filingArn().trim() || undefined,
        report_id: reportId,
      });
      this.toast.success(`${this.taskLabel(task.category)} marked as filed — client notified`);
      this.filingTask.set(null);
      await this.loadTasks(this.selectedPeriod());
      if (reportId) await this.load();
    } catch (e) {
      console.error(e);
      this.toast.error('Could not mark the return as filed');
    } finally {
      this.filingSaving.set(false);
    }
  }

  // --- GST payment amount + manual payment reminder ---

  amountDraft(t: ComplianceTask): string {
    return this.amountDrafts()[t.id] ?? t.amount ?? '';
  }

  setAmountDraft(t: ComplianceTask, value: string): void {
    this.amountDrafts.update((d) => ({ ...d, [t.id]: value }));
  }

  async saveAmount(t: ComplianceTask): Promise<void> {
    const value = this.amountDraft(t).trim();
    if (!value || Number(value) <= 0) {
      this.toast.error('Enter the GST payable amount');
      return;
    }
    await this.updatePayment(t, value);
    this.amountDrafts.update(({ [t.id]: _drop, ...rest }) => rest);
  }

  isReminding(id: string): boolean {
    return this.reminding().includes(id);
  }

  async sendPaymentReminder(t: ComplianceTask): Promise<void> {
    if (!t.amount) {
      this.toast.error('Save the payable amount first');
      return;
    }
    if (!confirm(`Send a GST payment reminder of ₹${t.amount} to this client on app, email and WhatsApp?`)) {
      return;
    }
    this.reminding.update((ids) => [...ids, t.id]);
    try {
      const { channels } = await this.tasksService.sendPaymentReminder(t.id);
      const ok = (Object.entries(channels) as [string, boolean][])
        .filter(([, v]) => v)
        .map(([k]) => ({ in_app: 'app', push: 'push', email: 'email', whatsapp: 'WhatsApp' })[k] ?? k);
      const failed = channels.whatsapp ? '' : ' (WhatsApp not delivered)';
      this.toast.success(`Payment reminder sent via ${ok.join(', ') || 'no channel'}${failed}`);
      await this.loadTasks(this.selectedPeriod());
    } catch (e) {
      console.error(e);
      this.toast.error('Failed to send payment reminder');
    } finally {
      this.reminding.update((ids) => ids.filter((x) => x !== t.id));
    }
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

  readonly uploadingCertType = signal<CertType | null>(null);

  certFor(certType: CertType): ClientCertificate | undefined {
    return this.certificates().find((c) => c.cert_type === certType);
  }

  hasCert(certType: CertType): boolean {
    return !!this.certFor(certType);
  }

  triggerCertFileInput(input: HTMLInputElement): void {
    input.value = '';
    input.click();
  }

  async onDirectCertFileSelected(event: Event, certType: CertType): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingCertType.set(certType);
    const certName = certType === 'gst_cert' ? 'GST Certificate' : 'Udyam Certificate';
    try {
      const { certificate_id, upload_url } = await this.certificatesService.uploadUrl(
        this.id(),
        {
          cert_type: certType,
          filename: file.name,
          contentType: file.type || 'application/pdf',
        },
      );
      await this.upload.upload(upload_url, file, file.type || 'application/pdf');
      await this.certificatesService.confirm(this.id(), certificate_id);
      this.toast.success(`${certName} uploaded successfully`);
      await this.load();
    } catch (e) {
      console.error(e);
      this.toast.error(`Failed to upload ${certName}`);
    } finally {
      this.uploadingCertType.set(null);
      input.value = '';
    }
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

  fmtBytes(size: string | number): string {
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
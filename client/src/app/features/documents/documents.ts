import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import {
  DocumentsService,
  PeriodsService,
  ComplianceTasksService,
  ComplianceTask,
  ReportRequestsService,
  ReportsService,
  ItrReturnsService,
  FamilyMembersService,
} from '../../core/services/feature.services';
import {
  Document,
  DocumentCategory,
  GstFilingPeriod,
  FamilyMember,
  ItrReturn,
  REPORT_TYPE_LABELS,
  Report,
} from '../../core/models';

import {
  FAMILY_RELATIONS,
  MAX_FAMILY_MEMBERS,
  currentAssessmentYear,
  itrYearLabel,
  recentAssessmentYears,
} from '../../../../../shared/constants/itr-year';

export interface TabOption {
  id: 'gst' | 'itr' | 'general';
  label: string;
  icon: string;
}

const UPLOAD_CATEGORIES = ['gstr_1', 'gstr_3b', 'iff'];
const NIL_CATEGORIES = ['gstr_1', 'iff'];

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documents.html',
})
export class Documents {
  private readonly documentsService = inject(DocumentsService);
  private readonly periodsService = inject(PeriodsService);
  private readonly tasksService = inject(ComplianceTasksService);
  private readonly reportReqsService = inject(ReportRequestsService);
  private readonly reportsService = inject(ReportsService);
  private readonly itrReturnsService = inject(ItrReturnsService);
  private readonly familyMembersService = inject(FamilyMembersService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  readonly availableTabs = computed<TabOption[]>(() => {
    const type = this.authService.userProfile()?.user_type ?? 'general';
    const tabs: TabOption[] = [];
    if (type === 'gst' || type === 'both') {
      tabs.push({ id: 'gst', label: 'GST', icon: 'receipt_long' });
    }
    if (type === 'itr' || type === 'both') {
      tabs.push({ id: 'itr', label: 'ITR', icon: 'account_balance' });
    }
    tabs.push({ id: 'general', label: 'General', icon: 'folder_open' });
    return tabs;
  });

  readonly activeTab = signal<'gst' | 'itr' | 'general'>('general');
  readonly loading = signal(true);
  readonly docs = signal<Document[]>([]);
  readonly total = signal(0);
  readonly filter = signal('');
  readonly periods = signal<GstFilingPeriod[]>([]);
  readonly periodId = signal('');
  readonly tasks = signal<ComplianceTask[]>([]);
  readonly reports = signal<Report[]>([]);
  readonly itrReturns = signal<ItrReturn[]>([]);
  /** The ITR year being filed now (previous FY); rolls over on 1 April. */
  readonly currentAy = currentAssessmentYear();
  /** Returns are shown for the current year and the three before it. */
  readonly recentAys = recentAssessmentYears(4);
  readonly itrYearLabel = itrYearLabel;

  /** Family members on this account; the ITR tab switches between people. */
  readonly members = signal<FamilyMember[]>([]);
  readonly maxMembers = MAX_FAMILY_MEMBERS;
  /** 'self' = the account holder, otherwise a family member id. */
  readonly selectedPerson = signal<string>('self');

  readonly selectedPersonName = computed(() => {
    const id = this.selectedPerson();
    if (id === 'self') return 'You';
    return this.members().find((m) => m.id === id)?.name ?? 'Family member';
  });

  /** One row per recent year for the selected person, with the return if filed. */
  readonly personReturns = computed(() => {
    const person = this.selectedPerson();
    return this.recentAys.map((ay) => ({
      ay,
      ret:
        this.itrReturns().find(
          (r) => r.assessment_year === ay && (r.family_member_id ?? 'self') === person,
        ) ?? null,
    }));
  });
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
    const initialPeriod = this.route.snapshot.queryParamMap.get('period');
    if (initialPeriod) this.periodId.set(initialPeriod);
    void this.init();
  }

  async init(): Promise<void> {
    const unlocked = this.availableTabs().map((t) => t.id);
    const qTab = this.route.snapshot.queryParamMap.get('tab') as
      | 'gst'
      | 'itr'
      | 'general'
      | null;

    if (qTab && unlocked.includes(qTab)) {
      this.activeTab.set(qTab);
    } else if (unlocked.includes('gst')) {
      this.activeTab.set('gst');
    } else if (unlocked.includes('itr')) {
      this.activeTab.set('itr');
    } else {
      this.activeTab.set('general');
    }

    try {
      if (unlocked.includes('gst')) {
        const periods = await this.periodsService.list();
        this.periods.set(periods);
        if (periods.length > 0) {
          if (!this.periodId()) this.periodId.set(periods[0].id);
          this.reportPeriodId = periods[0].id;
        }
      }
    } catch {
      /* non-fatal */
    }
    await this.load();
  }

  async selectTab(tab: 'gst' | 'itr' | 'general'): Promise<void> {
    this.activeTab.set(tab);
    this.page.set(1);
    await this.load();
  }

  async selectPerson(id: string): Promise<void> {
    if (this.selectedPerson() === id) return;
    this.selectedPerson.set(id);
    this.page.set(1);
    await this.load();
  }

  relationLabel(key: string): string {
    return FAMILY_RELATIONS.find((r) => r.key === key)?.label ?? key;
  }

  async load(): Promise<void> {
    this.loading.set(true);
    const tab = this.activeTab();
    try {
      if (tab === 'gst') {
        const pid = this.periodId();
        const [tasks, reportsRes, docsRes] = await Promise.all([
          pid ? this.tasksService.list(pid) : Promise.resolve<ComplianceTask[]>([]),
          this.reportsService.list({
            filingPeriodId: pid || undefined,
            pageSize: 100,
          }),
          this.documentsService.list({
            category: 'gst',
            filingPeriodId: pid || undefined,
            status: this.filter() || undefined,
            page: this.page(),
            pageSize: this.pageSize,
          }),
        ]);
        this.tasks.set(tasks);
        this.reports.set(reportsRes.items);
        this.docs.set(docsRes.items);
        this.total.set(docsRes.total);
      } else if (tab === 'itr') {
        const [returnsRes, docsRes, members] = await Promise.all([
          this.itrReturnsService.listMine().catch(() => []),
          this.documentsService.list({
            category: 'itr',
            assessmentYear: this.currentAy,
            familyMemberId: this.selectedPerson(),
            status: this.filter() || undefined,
            page: this.page(),
            pageSize: this.pageSize,
          }),
          this.familyMembersService.list().catch(() => [] as FamilyMember[]),
        ]);
        this.itrReturns.set(returnsRes);
        this.members.set(members);
        if (
          this.selectedPerson() !== 'self' &&
          !members.some((m) => m.id === this.selectedPerson())
        ) {
          this.selectedPerson.set('self');
        }
        this.docs.set(docsRes.items);
        this.total.set(docsRes.total);
        this.tasks.set([]);
        this.reports.set([]);
      } else {
        // general
        const docsRes = await this.documentsService.list({
          category: 'general',
          status: this.filter() || undefined,
          page: this.page(),
          pageSize: this.pageSize,
        });
        this.docs.set(docsRes.items);
        this.total.set(docsRes.total);
        this.tasks.set([]);
        this.reports.set([]);
      }
    } catch {
      this.tasks.set([]);
      this.reports.set([]);
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

  goUpload(): void {
    void this.router.navigate(['/documents/upload'], {
      queryParams: {
        category: this.activeTab(),
        period: this.activeTab() === 'gst' ? this.periodId() : undefined,
        ay: this.activeTab() === 'itr' ? this.currentAy : undefined,
        member:
          this.activeTab() === 'itr' && this.selectedPerson() !== 'self'
            ? this.selectedPerson()
            : undefined,
      },
    });
  }

  downloadItrReturn(ret: ItrReturn): void {
    if (ret.downloadUrl) {
      window.open(ret.downloadUrl, '_blank');
    }
  }

  async downloadDoc(doc: Document): Promise<void> {
    try {
      const res = await this.documentsService.downloadUrl(doc.id);
      window.open(res.download_url, '_blank');
    } catch {
      this.toast.error('Failed to download document');
    }
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

  fmtFiledDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
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

  formatSize(bytes: string | number): string {
    const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (isNaN(num) || num < 1024) return `${num || 0} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(0)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  }
}
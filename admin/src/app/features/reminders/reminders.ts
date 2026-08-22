import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ClientsService,
  PeriodsService,
  RemindersService,
} from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import { Client, FilingPeriod, Reminder } from '../../core/models';
import { PageHeader } from '../../shared/components/page-header';
import { StatusChip } from '../../shared/components/status-chip';
import { Pagination } from '../../shared/components/pagination';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

@Component({
  selector: 'app-reminders',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeader, StatusChip, Pagination, Spinner, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reminders.html',
})
export class Reminders implements OnInit {
  private readonly remindersService = inject(RemindersService);
  private readonly clientsService = inject(ClientsService);
  private readonly periodsService = inject(PeriodsService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  readonly periods = signal<FilingPeriod[]>([]);
  readonly clients = signal<Client[]>([]);
  readonly sending = signal(false);
  readonly sendingResult = signal<{ total: number; sent: number } | null>(null);

  readonly logLoading = signal(true);
  readonly log = signal<Reminder[]>([]);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly periodFilter = signal('');
  readonly statusFilter = signal('');

  readonly form = this.fb.nonNullable.group({
    target: ['single'],
    user_id: ['', Validators.required],
    filing_period_id: ['', Validators.required],
    channels: this.fb.nonNullable.array<string>([]),
  });

  constructor() {
    this.form.controls.target.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((target: string) => {
        const control = this.form.controls.user_id;
        if (target === 'all') {
          control.clearValidators();
        } else {
          control.setValidators([Validators.required]);
        }
        control.updateValueAndValidity();
      });
  }

  ngOnInit(): void {
    void this.loadMeta();
    void this.loadLog();
    this.route.queryParams.subscribe((params) => {
      const client = params['client'];
      if (client) {
        this.form.controls.target.setValue('single');
        this.form.controls.user_id.setValue(client);
      }
    });
  }

  async loadMeta(): Promise<void> {
    try {
      const [periods, clients] = await Promise.all([
        this.periodsService.open(),
        this.clientsService.list(1, 100),
      ]);
      this.periods.set(periods);
      this.clients.set(clients.items.filter((c) => c.status === 'active'));
      this.form.controls.filing_period_id.setValue(periods[0]?.id ?? '');
    } catch {
      this.periods.set([]);
      this.clients.set([]);
    }
  }

  toggleChannel(channel: string, checked: boolean): void {
    const arr = this.form.controls.channels;
    if (checked) {
      if (!arr.value.includes(channel)) arr.push(this.fb.nonNullable.control(channel));
    } else {
      const idx = arr.value.indexOf(channel);
      if (idx >= 0) arr.removeAt(idx);
    }
  }

  isChannelChecked(channel: string): boolean {
    return this.form.controls.channels.value.includes(channel);
  }

  async loadLog(): Promise<void> {
    this.logLoading.set(true);
    try {
      const res = await this.remindersService.log({
        page: this.page(),
        pageSize: this.pageSize(),
        filing_period_id: this.periodFilter() || undefined,
        status: this.statusFilter() || undefined,
      });
      this.log.set(res.items);
      this.total.set(res.total);
      this.totalPages.set(res.totalPages);
    } finally {
      this.logLoading.set(false);
    }
  }

  applyFilters(): void {
    this.page.set(1);
    void this.loadLog();
  }

  pageChanged(p: number): void {
    this.page.set(p);
    void this.loadLog();
  }

  async send(): Promise<void> {
    const f = this.form;
    if (f.invalid || f.controls.channels.value.length === 0) {
      f.markAllAsTouched();
      this.toast.error('Select a client (or all unfiled) and at least one channel');
      return;
    }
    this.sending.set(true);
    this.sendingResult.set(null);
    try {
      const isAll = f.controls.target.value === 'all';
      const result = await this.remindersService.send({
        user_id: isAll ? undefined : f.controls.user_id.value,
        all_unfiled: isAll,
        filing_period_id: f.controls.filing_period_id.value,
        channels: f.controls.channels.value,
      });
      this.sendingResult.set(result);
      this.toast.success(`Reminders sent: ${result.sent} of ${result.total}`);
      await this.loadLog();
    } finally {
      this.sending.set(false);
    }
  }

  fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
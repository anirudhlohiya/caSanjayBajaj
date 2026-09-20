import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PeriodsService } from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import { FilingPeriod } from '../../core/models';
import { PageHeader } from '../../shared/components/page-header';
import { Modal } from '../../shared/components/modal';
import { StatusChip } from '../../shared/components/status-chip';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeader, Modal, StatusChip, Spinner, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.html',
})
export class Settings implements OnInit {
  private readonly periodsService = inject(PeriodsService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly periods = signal<FilingPeriod[]>([]);
  readonly showAdd = signal(false);
  readonly saving = signal(false);

  readonly addForm = this.fb.nonNullable.group({
    period_label: ['', [Validators.required, Validators.maxLength(30)]],
    period_code: ['', [Validators.required, Validators.maxLength(7)]],
    due_date: ['', Validators.required],
    is_open: [true],
    schedule: this.buildScheduleGroup(),
  });

  readonly showEdit = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly editForm = this.fb.nonNullable.group({
    period_label: ['', [Validators.required, Validators.maxLength(30)]],
    due_date: ['', Validators.required],
    is_open: [true],
    schedule: this.buildScheduleGroup(),
  });

  private buildScheduleGroup() {
    return this.fb.nonNullable.group({
      gstr1: this.fb.nonNullable.group({
        due: [''],
        reminders: this.fb.nonNullable.array([this.fb.control(''), this.fb.control(''), this.fb.control('')]),
      }),
      gstr3b: this.fb.nonNullable.group({
        due: [''],
        reminders: this.fb.nonNullable.array([this.fb.control('')]),
      }),
      iff: this.fb.nonNullable.group({
        due: [''],
        reminders: this.fb.nonNullable.array([this.fb.control(''), this.fb.control(''), this.fb.control('')]),
      }),
      payment: this.fb.nonNullable.group({
        due: [''],
        reminders: this.fb.nonNullable.array([]),
      }),
      quarterly: this.fb.nonNullable.group({
        gstr3b: this.fb.nonNullable.group({
          quarter_label: [''],
          due: [''],
          reminders: this.fb.nonNullable.array([this.fb.control('')]),
        }),
      }),
    });
  }

  ngOnInit(): void {
    void this.load();
    const codeCtrl = this.addForm.get('period_code');
    const dueCtrl = this.addForm.get('due_date');
    codeCtrl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.prefillSchedule());
    dueCtrl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.prefillSchedule());
  }

  private readonly MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  /**
   * Mirror of SchedulingService.defaultScheduleForPeriodCode (docs/13 §3.2):
   * default dates for a period, computed from its YYYY-MM period code. The
   * backend applies exactly these when an admin leaves the schedule blank,
   * so we prefill them so the editor always shows what will actually fire.
   */
  private defaultScheduleFor(periodCode: string) {
    const [yearStr, monthStr] = periodCode.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const pad = (d: number) => String(d).padStart(2, '0');
    const inPeriod = (day: number) => `${year}-${pad(month)}-${pad(day)}`;
    const qIndex = Math.floor((month - 1) / 3);
    const endMonth = qIndex * 3 + 3;
    const settlingMonth = endMonth === 12 ? 1 : endMonth + 1;
    const settlingYear = endMonth === 12 ? year + 1 : year;
    const inSettling = (day: number) =>
      `${settlingYear}-${pad(settlingMonth)}-${pad(day)}`;
    const startMonth = qIndex * 3 + 1;

    return {
      gstr1: {
        due: inPeriod(11),
        reminders: [inPeriod(5), inPeriod(7), inPeriod(11)],
      },
      gstr3b: {
        due: inPeriod(20),
        reminders: [inPeriod(18)],
      },
      iff: {
        due: inPeriod(13),
        reminders: [inPeriod(5), inPeriod(7), inPeriod(11)],
      },
      payment: {
        due: inPeriod(20),
        reminders: [],
      },
      quarterly: {
        gstr3b: {
          quarter_label: `${this.MONTHS[startMonth - 1]}–${this.MONTHS[endMonth - 1]} ${year}`,
          due: inSettling(22),
          reminders: [inSettling(20)],
        },
      },
    };
  }

  private scheduleIsBlank(): boolean {
    const s = this.addForm.get('schedule');
    if (!s) return true;
    const raw = s.getRawValue() as Record<string, unknown>;
    const walk = (node: unknown): boolean => {
      if (node == null) return true;
      if (typeof node === 'string') return node === '';
      if (Array.isArray(node)) return node.every((x) => walk(x));
      if (typeof node === 'object') {
        return Object.values(node).every((x) => walk(x));
      }
      return true;
    };
    return walk(raw);
  }

  prefillSchedule(): void {
    if (!this.scheduleIsBlank()) return;
    let periodCode = this.addForm.get('period_code')?.value ?? '';
    if (!/^\d{4}-\d{2}$/.test(periodCode)) {
      const due = this.addForm.get('due_date')?.value ?? '';
      periodCode = /^\d{4}-\d{2}/.test(due) ? due.slice(0, 7) : '';
    }
    if (!periodCode) return;
    try {
      this.addForm.patchValue({ schedule: this.defaultScheduleFor(periodCode) });
    } catch {
      // invalid period code — leave the editor untouched
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.periods.set(await this.periodsService.list());
    } finally {
      this.loading.set(false);
    }
  }

  openAdd(): void {
    this.addForm.reset({ is_open: true });
    this.prefillSchedule();
    this.showAdd.set(true);
  }

  async submitAdd(): Promise<void> {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const f = this.addForm.value;
      await this.periodsService.create({
        period_label: f.period_label ?? '',
        period_code: f.period_code ?? '',
        due_date: f.due_date ?? '',
        is_open: f.is_open,
        schedule: f.schedule as any,
      });
      this.toast.success('Filing period created');
      this.showAdd.set(false);
      await this.load();
    } finally {
      this.saving.set(false);
    }
  }

  openEdit(p: FilingPeriod): void {
    this.editingId.set(p.id);
    this.editForm.reset({
      period_label: p.period_label,
      due_date: p.due_date.split('T')[0], // if ISO date
      is_open: p.is_open,
    });
    if (p.schedule) {
      this.editForm.patchValue({ schedule: p.schedule });
    }
    this.showEdit.set(true);
  }

  async submitEdit(): Promise<void> {
    if (this.editForm.invalid || !this.editingId()) {
      this.editForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const f = this.editForm.value;
      await this.periodsService.update(this.editingId()!, {
        period_label: f.period_label ?? '',
        due_date: f.due_date ?? '',
        is_open: f.is_open,
        schedule: f.schedule as any,
      });
      this.toast.success('Filing period updated');
      this.showEdit.set(false);
      await this.load();
    } finally {
      this.saving.set(false);
    }
  }

  async toggleOpen(p: FilingPeriod): Promise<void> {
    await this.periodsService.update(p.id, { is_open: !p.is_open });
    this.toast.success(p.is_open ? 'Period closed' : 'Period reopened');
    await this.load();
  }

  fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
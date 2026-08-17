import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
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

  readonly loading = signal(true);
  readonly periods = signal<FilingPeriod[]>([]);
  readonly showAdd = signal(false);
  readonly saving = signal(false);

  readonly addForm = this.fb.nonNullable.group({
    period_label: ['', [Validators.required, Validators.maxLength(30)]],
    period_code: ['', [Validators.required, Validators.maxLength(7)]],
    due_date: ['', Validators.required],
    is_open: [true],
  });

  ngOnInit(): void {
    void this.load();
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
      });
      this.toast.success('Filing period created');
      this.showAdd.set(false);
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
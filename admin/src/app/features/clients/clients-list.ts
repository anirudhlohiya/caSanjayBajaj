import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientsService } from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import { Client } from '../../core/models';
import { PageHeader } from '../../shared/components/page-header';
import { Pagination } from '../../shared/components/pagination';
import { Modal } from '../../shared/components/modal';
import { StatusChip } from '../../shared/components/status-chip';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

function gstClientValidator(control: AbstractControl): ValidationErrors | null {
  const userType = control.get('user_type')?.value;
  if (userType !== 'gst') return null;
  const phone = control.get('phone')?.value;
  const gstin = control.get('gstin')?.value;
  const errors: ValidationErrors = {};
  if (!phone || !/^\d{10,20}$/.test(phone)) {
    errors['phoneRequired'] = true;
    control.get('phone')?.setErrors({ required: true });
  }
  if (!gstin || !/^[0-9A-Za-z]{15}$/.test(gstin)) {
    errors['gstinRequired'] = true;
    control.get('gstin')?.setErrors({ required: true });
  }
  return Object.keys(errors).length ? errors : null;
}

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeader, Pagination, Modal, StatusChip, Spinner, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clients-list.html',
})
export class ClientsList implements OnInit {
  private readonly clientsService = inject(ClientsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly clients = signal<Client[]>([]);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly query = signal('');
  readonly showAdd = signal(false);
  readonly adding = signal(false);
  readonly dupEmail = signal('');

  readonly addForm = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.maxLength(120)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      phone: ['', [Validators.pattern(/^\d{10,20}$/)]],
      gstin: ['', [Validators.pattern(/^[0-9A-Za-z]{15}$/)]],
      user_type: ['gst'],
      status: ['active'],
    },
    { validators: gstClientValidator },
  );

  readonly filtered = computed(() => {
    const q = this.query().toLowerCase().trim();
    if (!q) return this.clients();
    return this.clients().filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.gstin ?? '').toLowerCase().includes(q),
    );
  });

  ngOnInit(): void {
    void this.load();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((qp) => {
      if (qp.get('action') === 'add') {
        this.openAdd();
        void this.router.navigate([], { queryParams: { action: null }, queryParamsHandling: 'merge', replaceUrl: true });
      }
    });
    this.addForm.get('user_type')?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const phoneCtrl = this.addForm.get('phone');
      const gstinCtrl = this.addForm.get('gstin');
      if (this.addForm.get('user_type')?.value === 'gst') {
        phoneCtrl?.setValidators([Validators.required, Validators.pattern(/^\d{10,20}$/)]);
        gstinCtrl?.setValidators([Validators.required, Validators.pattern(/^[0-9A-Za-z]{15}$/)]);
      } else {
        phoneCtrl?.clearValidators();
        gstinCtrl?.clearValidators();
      }
      phoneCtrl?.updateValueAndValidity();
      gstinCtrl?.updateValueAndValidity();
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.clientsService.list(this.page(), this.pageSize());
      this.clients.set(res.items);
      this.total.set(res.total);
      this.totalPages.set(res.totalPages);
    } finally {
      this.loading.set(false);
    }
  }

  pageChanged(p: number): void {
    this.page.set(p);
    void this.load();
  }

  openAdd(): void {
    this.addForm.reset({ user_type: 'gst', status: 'active' });
    this.dupEmail.set('');
    const phoneCtrl = this.addForm.get('phone');
    const gstinCtrl = this.addForm.get('gstin');
    phoneCtrl?.setValidators([Validators.required, Validators.pattern(/^\d{10,20}$/)]);
    gstinCtrl?.setValidators([Validators.required, Validators.pattern(/^[0-9A-Za-z]{15}$/)]);
    phoneCtrl?.updateValueAndValidity();
    gstinCtrl?.updateValueAndValidity();
    this.showAdd.set(true);
  }

  async submitAdd(): Promise<void> {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }
    this.dupEmail.set('');
    this.adding.set(true);
    try {
      const f = this.addForm.value;
      await this.clientsService.create({
        name: f.name ?? '',
        email: f.email ?? '',
        password: f.password ?? '',
        phone: f.phone || undefined,
        gstin: f.gstin ? f.gstin.toUpperCase() : undefined,
        user_type: f.user_type,
        status: f.status,
      });
      this.toast.success('Client added');
      this.showAdd.set(false);
      await this.load();
    } catch (err) {
      const msg = err instanceof HttpErrorResponse ? (err.error?.message ?? '') : '';
      if (typeof msg === 'string' && /already exists/i.test(msg)) {
        this.dupEmail.set(msg);
        this.addForm.controls.email.markAsTouched();
      } else if (!/already exists/i.test(String(msg))) {
        throw err;
      }
    } finally {
      this.adding.set(false);
    }
  }

  viewClient(id: string): void {
    void this.router.navigate(['/clients', id]);
  }

  sendReminder(id: string): void {
    void this.router.navigate(['/reminders'], { queryParams: { client: id } });
  }

  fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { StaffService } from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import { Admin } from '../../core/models';
import { PageHeader } from '../../shared/components/page-header';
import { Modal } from '../../shared/components/modal';
import { StatusChip } from '../../shared/components/status-chip';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeader, Modal, StatusChip, Spinner, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './staff.html',
})
export class Staff implements OnInit {
  private readonly staffService = inject(StaffService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly staff = signal<Admin[]>([]);
  readonly showAdd = signal(false);
  readonly adding = signal(false);

  readonly permAdmin = signal<Admin | null>(null);
  readonly permLoading = signal(false);
  readonly permSaving = signal(false);
  readonly granted = signal<Set<string>>(new Set());

  readonly permissionLabels: Record<string, string> = {
    view_clients: 'View clients',
    view_documents: 'View documents',
    upload_reports: 'Upload reports',
    send_reminders: 'Send reminders',
    manage_staff: 'Manage staff',
    view_audit_logs: 'View audit logs',
    manage_settings: 'Manage settings',
  };

  readonly permissionEntries = computed(() =>
    Object.entries(this.permissionLabels),
  );

  readonly addForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['staff'],
    status: ['active'],
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.staff.set(await this.staffService.list());
    } finally {
      this.loading.set(false);
    }
  }

  openAdd(): void {
    this.addForm.reset({ role: 'staff', status: 'active' });
    this.showAdd.set(true);
  }

  async submitAdd(): Promise<void> {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }
    this.adding.set(true);
    try {
      const f = this.addForm.value;
      await this.staffService.create({
        name: f.name ?? '',
        email: f.email ?? '',
        password: f.password ?? '',
        role: f.role,
        status: f.status,
      });
      this.toast.success('Staff account created');
      this.showAdd.set(false);
      await this.load();
    } finally {
      this.adding.set(false);
    }
  }

  async deactivate(admin: Admin): Promise<void> {
    await this.staffService.deactivate(admin.id);
    this.toast.success(`${admin.name} deactivated`);
    await this.load();
  }

  async reactivate(admin: Admin): Promise<void> {
    await this.staffService.update(admin.id, { status: 'active' });
    this.toast.success(`${admin.name} reactivated`);
    await this.load();
  }

  async openPermissions(admin: Admin): Promise<void> {
    this.permAdmin.set(admin);
    this.granted.set(new Set());
    this.permLoading.set(true);
    try {
      const perms = await this.staffService.getPermissions(admin.id);
      this.granted.set(
        new Set(perms.filter((p) => p.granted).map((p) => p.permission_key)),
      );
    } finally {
      this.permLoading.set(false);
    }
  }

  togglePermission(key: string, checked: boolean): void {
    const next = new Set(this.granted());
    if (checked) next.add(key);
    else next.delete(key);
    this.granted.set(next);
  }

  async savePermissions(): Promise<void> {
    const admin = this.permAdmin();
    if (!admin) return;
    this.permSaving.set(true);
    try {
      await this.staffService.setPermissions(admin.id, [...this.granted()]);
      this.toast.success('Permissions updated');
      this.permAdmin.set(null);
    } finally {
      this.permSaving.set(false);
    }
  }

  fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
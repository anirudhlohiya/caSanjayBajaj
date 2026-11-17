import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
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

  /** One row per area of the panel. `view` is absent where there is only on/off. */
  readonly areas: { label: string; hint: string; view?: string; manage: string }[] = [
    { label: 'Clients', hint: 'Client list, profiles, family members, filing checklist', view: 'view_clients', manage: 'manage_clients' },
    { label: 'Documents', hint: 'Files uploaded by clients', view: 'view_documents', manage: 'manage_documents' },
    { label: 'Reports and filed returns', hint: 'GST reports, ITR returns, certificates, mark as filed', view: 'view_reports', manage: 'manage_reports' },
    { label: 'Reminders', hint: 'Send document and payment reminders', manage: 'send_reminders' },
    { label: 'Support tickets', hint: 'Read and reply to client tickets', manage: 'manage_tickets' },
    { label: 'WhatsApp chats', hint: 'Read and reply on the firm WhatsApp number', manage: 'manage_whatsapp' },
    { label: 'Rent agreements', hint: 'Create, edit and download agreements', manage: 'manage_rent_agreements' },
    { label: 'Website content', hint: 'Blog, enquiries, services, due dates, FAQs', manage: 'manage_website' },
    { label: 'Settings', hint: 'Filing periods and schedules', manage: 'manage_settings' },
    { label: 'Audit logs', hint: 'See who did what', manage: 'view_audit_logs' },
  ];

  // Mirrors PERMISSION_IMPLIES in backend/src/common/enums (the server applies it again on save).
  private readonly implies: Record<string, string[]> = {
    manage_clients: ['view_clients'],
    manage_documents: ['view_documents'],
    view_reports: ['view_clients'],
    manage_reports: ['view_reports', 'view_clients'],
    send_reminders: ['view_clients'],
    manage_whatsapp: ['view_clients'],
  };

  readonly resetAdmin = signal<Admin | null>(null);
  readonly resetting = signal(false);
  readonly resetForm = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

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

  levelOf(area: { view?: string; manage: string }): 'none' | 'view' | 'manage' {
    const g = this.granted();
    if (g.has(area.manage)) return 'manage';
    return area.view && g.has(area.view) ? 'view' : 'none';
  }

  /** Choices for one area's segmented switch. */
  levelsFor(area: { view?: string }): { value: 'none' | 'view' | 'manage'; label: string }[] {
    return area.view
      ? [
          { value: 'none', label: 'No access' },
          { value: 'view', label: 'Can view' },
          { value: 'manage', label: 'Can view and change' },
        ]
      : [
          { value: 'none', label: 'No access' },
          { value: 'manage', label: 'Allowed' },
        ];
  }

  setLevel(area: { view?: string; manage: string }, level: string): void {
    const next = new Set(this.granted());
    next.delete(area.manage);
    if (area.view) next.delete(area.view);
    if (level === 'manage') next.add(area.manage);
    if (level === 'view' && area.view) next.add(area.view);
    // Re-add anything another area still needs (e.g. Reports needs Clients: view).
    for (const key of [...next]) {
      for (const implied of this.implies[key] ?? []) next.add(implied);
    }
    this.granted.set(next);
  }

  /** 14 characters, no look-alikes (0/O, 1/l/I), from the browser's secure generator. */
  generatePassword(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = crypto.getRandomValues(new Uint32Array(14));
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  }

  openReset(admin: Admin): void {
    this.resetForm.reset({ password: '' });
    this.resetAdmin.set(admin);
  }

  async submitReset(): Promise<void> {
    const admin = this.resetAdmin();
    if (!admin) return;
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }
    this.resetting.set(true);
    try {
      await this.staffService.resetPassword(admin.id, this.resetForm.controls.password.value);
      this.toast.success(`New password set for ${admin.name}`);
      this.resetAdmin.set(null);
    } finally {
      this.resetting.set(false);
    }
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
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ClientsService } from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import { Client } from '../../core/models';
import { PageHeader } from '../../shared/components/page-header';
import { Pagination } from '../../shared/components/pagination';
import { Modal } from '../../shared/components/modal';
import { StatusChip } from '../../shared/components/status-chip';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

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
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly clients = signal<Client[]>([]);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly query = signal('');
  readonly showAdd = signal(false);
  readonly adding = signal(false);

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

  readonly addForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    phone: ['', [Validators.pattern(/^\d{10,20}$/)]],
    gstin: ['', [Validators.pattern(/^[0-9A-Za-z]{15}$/)]],
    user_type: ['gst'],
    status: ['active'],
  });

  ngOnInit(): void {
    void this.load();
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
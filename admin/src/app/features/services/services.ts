import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ServicesOfferedService } from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import { Service } from '../../core/models';
import { PageHeader } from '../../shared/components/page-header';
import { Modal } from '../../shared/components/modal';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeader, Modal, Spinner, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './services.html',
})
export class ServicesPage implements OnInit {
  private readonly servicesService = inject(ServicesOfferedService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly services = signal<Service[]>([]);
  readonly showModal = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.required]],
    price: [''],
    icon: [''],
    display_order: [0],
    is_active: [true],
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.services.set(await this.servicesService.list());
    } finally {
      this.loading.set(false);
    }
  }

  openAdd(): void {
    this.form.reset({ title: '', description: '', price: '', icon: '', display_order: 0, is_active: true });
    this.editingId.set(null);
    this.showModal.set(true);
  }

  openEdit(s: Service): void {
    this.form.patchValue({
      title: s.title,
      description: s.description,
      price: s.price ?? '',
      icon: s.icon ?? '',
      display_order: s.display_order,
      is_active: s.is_active,
    });
    this.editingId.set(s.id);
    this.showModal.set(true);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const f = this.form.value;
      const body = {
        title: f.title ?? '',
        description: f.description ?? '',
        price: f.price || undefined,
        icon: f.icon || undefined,
        display_order: f.display_order ?? 0,
        is_active: f.is_active ?? true,
      };
      if (this.editingId()) {
        await this.servicesService.update(this.editingId()!, body);
        this.toast.success('Service updated');
      } else {
        await this.servicesService.create(body);
        this.toast.success('Service created');
      }
      this.showModal.set(false);
      await this.load();
    } finally {
      this.saving.set(false);
    }
  }

  async deactivate(id: string): Promise<void> {
    if (!confirm('Deactivate this service?')) return;
    await this.servicesService.deactivate(id);
    this.toast.success('Service deactivated');
    await this.load();
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ServicesOfferedService } from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import { Service } from '../../core/models';
import { serviceTileClass } from '../../core/service-palette';
import { PageHeader } from '../../shared/components/page-header';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

type Filter = 'all' | 'active' | 'hidden';

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [FormsModule, RouterLink, PageHeader, Spinner, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './services.html',
})
export class ServicesPage implements OnInit {
  private readonly servicesService = inject(ServicesOfferedService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly services = signal<Service[]>([]);
  readonly filter = signal<Filter>('all');
  readonly search = signal('');
  readonly busyId = signal<string | null>(null);

  // Firm-wide contact numbers for the client app's Call / WhatsApp buttons
  readonly contactPhone = signal('');
  readonly contactWhatsapp = signal('');
  readonly savingContact = signal(false);
  private savedContact = { phone: '', whatsapp: '' };
  readonly contactDirty = computed(
    () =>
      this.contactPhone().trim() !== this.savedContact.phone ||
      this.contactWhatsapp().trim() !== this.savedContact.whatsapp,
  );

  readonly counts = computed(() => {
    const all = this.services();
    const active = all.filter((s) => s.is_active).length;
    return { all: all.length, active, hidden: all.length - active };
  });

  readonly visible = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.services().filter((s) => {
      if (this.filter() === 'active' && !s.is_active) return false;
      if (this.filter() === 'hidden' && s.is_active) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  });

  /** Reordering only makes sense on the full, unfiltered list. */
  readonly canReorder = computed(() => this.filter() === 'all' && !this.search().trim());

  readonly tileClass = serviceTileClass;

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [services, contact] = await Promise.all([
        this.servicesService.list(),
        this.servicesService.getContact(),
      ]);
      this.services.set(services);
      this.savedContact = { phone: contact.phone ?? '', whatsapp: contact.whatsapp ?? '' };
      this.contactPhone.set(this.savedContact.phone);
      this.contactWhatsapp.set(this.savedContact.whatsapp);
    } finally {
      this.loading.set(false);
    }
  }

  open(s: Service): void {
    void this.router.navigate(['/services', s.id]);
  }

  async toggleActive(s: Service, event: Event): Promise<void> {
    event.stopPropagation();
    this.busyId.set(s.id);
    try {
      const updated = await this.servicesService.update(s.id, { is_active: !s.is_active });
      this.services.update((list) => list.map((x) => (x.id === s.id ? updated : x)));
      this.toast.success(updated.is_active ? `${s.title} is visible to clients` : `${s.title} is hidden`);
    } finally {
      this.busyId.set(null);
    }
  }

  async move(index: number, delta: -1 | 1, event: Event): Promise<void> {
    event.stopPropagation();
    const list = [...this.services()];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    this.services.set(list);
    try {
      this.services.set(await this.servicesService.reorder(list.map((s) => s.id)));
    } catch {
      await this.load();
    }
  }

  async saveContact(): Promise<void> {
    this.savingContact.set(true);
    try {
      const saved = await this.servicesService.setContact({
        phone: this.contactPhone().trim(),
        whatsapp: this.contactWhatsapp().trim(),
      });
      this.savedContact = { phone: saved.phone ?? '', whatsapp: saved.whatsapp ?? '' };
      this.contactPhone.set(this.savedContact.phone);
      this.contactWhatsapp.set(this.savedContact.whatsapp);
      this.toast.success('Contact numbers saved');
    } finally {
      this.savingContact.set(false);
    }
  }
}

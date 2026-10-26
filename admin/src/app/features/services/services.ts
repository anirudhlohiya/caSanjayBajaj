import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ServicesOfferedService } from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import { Service, ServiceContact } from '../../core/models';
import { serviceTileClass } from '../../core/service-palette';
import { PageHeader } from '../../shared/components/page-header';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';
import { Modal } from '../../shared/components/modal';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ContactForm {
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  map_url: string;
  open_from: string;
  open_to: string;
  open_days: number[];
}

type Filter = 'all' | 'active' | 'hidden';

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [FormsModule, RouterLink, PageHeader, Spinner, EmptyState, Modal],
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

  // Firm contact details: service-page buttons, Contact Us and Talk to Expert
  readonly contact = signal<ServiceContact | null>(null);
  readonly contactModal = signal(false);
  readonly savingContact = signal(false);
  readonly contactForm = signal<ContactForm>(emptyForm());
  readonly weekdays = WEEKDAYS;

  readonly hoursLabel = computed(() => {
    const c = this.contact();
    return c ? formatHours(c.open_days, c.open_from, c.open_to) : '';
  });

  readonly contactErrors = computed(() => {
    const f = this.contactForm();
    const errors: string[] = [];
    const phone = /^$|^\+?[0-9 ]{8,16}$/;
    if (!phone.test(f.phone.trim())) errors.push('Call number looks wrong');
    if (!phone.test(f.whatsapp.trim())) errors.push('WhatsApp number looks wrong');
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) errors.push('Email looks wrong');
    if (f.map_url.trim() && !/^https:\/\/\S+$/.test(f.map_url.trim())) errors.push('Map link must start with https://');
    if (!f.open_from || !f.open_to || f.open_from >= f.open_to) errors.push('Closing time must be after opening time');
    if (!f.open_days.length) errors.push('Pick at least one working day');
    return errors;
  });

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
      this.contact.set(contact);
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

  openContact(): void {
    const c = this.contact();
    this.contactForm.set({
      phone: c?.phone ?? '',
      whatsapp: c?.whatsapp ?? '',
      email: c?.email ?? '',
      address: c?.address ?? '',
      map_url: c?.map_url ?? '',
      open_from: c?.open_from ?? '10:00',
      open_to: c?.open_to ?? '19:00',
      open_days: [...(c?.open_days ?? [1, 2, 3, 4, 5, 6])],
    });
    this.contactModal.set(true);
  }

  setContactField<K extends keyof ContactForm>(key: K, value: ContactForm[K]): void {
    this.contactForm.update((f) => ({ ...f, [key]: value }));
  }

  toggleDay(day: number): void {
    const days = this.contactForm().open_days;
    this.setContactField(
      'open_days',
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort(),
    );
  }

  async saveContact(): Promise<void> {
    if (this.contactErrors().length || this.savingContact()) return;
    this.savingContact.set(true);
    const f = this.contactForm();
    try {
      const saved = await this.servicesService.setContact({
        phone: f.phone.trim(),
        whatsapp: f.whatsapp.trim(),
        email: f.email.trim(),
        address: f.address.trim(),
        map_url: f.map_url.trim(),
        open_from: f.open_from,
        open_to: f.open_to,
        open_days: f.open_days,
      });
      this.contact.set(saved);
      this.contactModal.set(false);
      this.toast.success('Contact details saved');
    } finally {
      this.savingContact.set(false);
    }
  }
}

function emptyForm(): ContactForm {
  return {
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    map_url: '',
    open_from: '10:00',
    open_to: '19:00',
    open_days: [1, 2, 3, 4, 5, 6],
  };
}

/** "Mon–Sat, 10:00 AM – 7:00 PM" */
function formatHours(days: number[], from: string, to: string): string {
  const sorted = [...days].sort();
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  const dayText = !sorted.length
    ? 'Closed'
    : contiguous && sorted.length > 2
      ? `${WEEKDAYS[sorted[0]]}–${WEEKDAYS[sorted[sorted.length - 1]]}`
      : sorted.map((d) => WEEKDAYS[d]).join(', ');
  return `${dayText}, ${to12h(from)} – ${to12h(to)}`;
}

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
}


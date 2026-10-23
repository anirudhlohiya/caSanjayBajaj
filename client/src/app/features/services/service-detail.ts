import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { marked } from 'marked';
import { ServicesOfferedService } from '../../core/services/feature.services';
import { ServiceDetail } from '../../core/models';
import { serviceTileClass } from '../../core/service-palette';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

/** Digits for wa.me / tel: links; bare 10-digit numbers are Indian (+91). */
function phoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

@Component({
  selector: 'app-service-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, Spinner, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './service-detail.html',
})
export class ServiceDetailPage {
  private readonly servicesService = inject(ServicesOfferedService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly service = signal<ServiceDetail | null>(null);

  readonly showRequest = signal(false);
  readonly requestMessage = signal('');
  readonly sending = signal(false);
  /** Ticket id once the request has been sent (switches the sheet to the confirmation). */
  readonly sentTicketId = signal<string | null>(null);

  readonly html = computed(() =>
    marked.parse(this.service()?.body_md ?? '', { async: false, gfm: true }),
  );

  readonly callHref = computed(() => {
    const phone = this.service()?.contact.phone;
    return phone ? `tel:+${phoneDigits(phone)}` : null;
  });

  readonly whatsappHref = computed(() => {
    const s = this.service();
    const phone = s?.contact.whatsapp;
    if (!s || !phone) return null;
    const text = encodeURIComponent(
      `Hello, I'd like to know more about ${s.title}.`,
    );
    return `https://wa.me/${phoneDigits(phone)}?text=${text}`;
  });

  readonly tileClass = serviceTileClass;

  constructor() {
    this.route.paramMap.subscribe((params) => {
      void this.load(params.get('slug') ?? '');
    });
  }

  async load(slug: string): Promise<void> {
    this.loading.set(true);
    this.notFound.set(false);
    try {
      this.service.set(await this.servicesService.get(slug));
    } catch {
      this.service.set(null);
      this.notFound.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  openRequest(): void {
    this.requestMessage.set('');
    this.sentTicketId.set(null);
    this.showRequest.set(true);
  }

  closeSheet(): void {
    if (this.sending()) return;
    this.showRequest.set(false);
  }

  async viewRequest(): Promise<void> {
    const id = this.sentTicketId();
    this.showRequest.set(false);
    if (id) await this.router.navigate(['/support', id]);
  }

  async submitRequest(): Promise<void> {
    const s = this.service();
    if (!s || this.sending()) return;
    this.sending.set(true);
    try {
      const ticket = await this.servicesService.enquire(
        s.slug,
        this.requestMessage().trim(),
      );
      this.sentTicketId.set(ticket.id);
    } catch {
      /* toast handled by interceptor */
    } finally {
      this.sending.set(false);
    }
  }
}

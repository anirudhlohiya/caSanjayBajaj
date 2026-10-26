import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import {
  FirmContactService,
  hoursLabel,
  officeStatus,
  telHref,
  whatsappHref,
} from '../../core/firm-contact';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

@Component({
  selector: 'app-talk-to-expert',
  standalone: true,
  imports: [Spinner, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './talk-to-expert.html',
})
export class TalkToExpert implements OnDestroy {
  private readonly firm = inject(FirmContactService);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly contact = this.firm.contact;
  /** Re-evaluated every minute so the Call button enables / disables on time. */
  private readonly now = signal(new Date());
  private readonly timer = setInterval(() => this.now.set(new Date()), 60000);

  readonly status = computed(() => {
    const c = this.contact();
    return c ? officeStatus(c, this.now()) : null;
  });
  readonly hours = computed(() => {
    const c = this.contact();
    return c ? hoursLabel(c) : '';
  });
  readonly whatsappHref = computed(() => {
    const c = this.contact();
    const number = c?.whatsapp || c?.phone;
    return number
      ? whatsappHref(number, 'Hello, I would like to talk to a CA about ')
      : null;
  });
  /** Only while the office is open. */
  readonly callHref = computed(() => {
    const phone = this.contact()?.phone;
    return phone && this.status()?.open ? telHref(phone) : null;
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      await this.firm.load();
    } catch {
      this.failed.set(!this.contact());
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TicketsService } from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import {
  Ticket,
  TicketAttachment,
  TICKET_STATUS_COLORS,
  TICKET_CATEGORY_LABELS,
} from '../../core/models';
import { Spinner } from '../../shared/components/spinner';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-detail.html',
})
export class TicketDetail implements OnInit {
  private readonly ticketsService = inject(TicketsService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly ticket = signal<Ticket | null>(null);
  readonly downloading = signal(false);
  readonly replyText = signal('');
  readonly sending = signal(false);
  readonly closing = signal(false);

  /** "Service enquiry: GST Services" → "GST Services" (requests from a service page). */
  readonly enquiryService = computed(() => {
    const match = /^Service enquiry: (.+)$/.exec(this.ticket()?.subject ?? '');
    return match ? match[1] : null;
  });

  readonly statusColors = TICKET_STATUS_COLORS;
  readonly categoryLabels = TICKET_CATEGORY_LABELS;

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) void this.load(id);
    });
  }

  async load(id: string): Promise<void> {
    this.loading.set(true);
    try {
      this.ticket.set(await this.ticketsService.get(id));
    } finally {
      this.loading.set(false);
    }
  }

  async closeTicket(): Promise<void> {
    const t = this.ticket();
    if (!t || this.closing()) return;
    if (!confirm('Close this request? You can always raise a new one.')) return;
    this.closing.set(true);
    try {
      await this.ticketsService.close(t.id);
      this.toast.success('Request closed');
      await this.load(t.id);
    } finally {
      this.closing.set(false);
    }
  }

  async sendReply(): Promise<void> {
    const t = this.ticket();
    const text = this.replyText().trim();
    if (!t || !text || this.sending()) return;
    this.sending.set(true);
    try {
      await this.ticketsService.reply(t.id, text);
      this.replyText.set('');
      await this.load(t.id);
    } catch {
      /* toast handled by interceptor */
    } finally {
      this.sending.set(false);
    }
  }

  async download(att: TicketAttachment): Promise<void> {
    if (this.downloading()) return;
    this.downloading.set(true);
    try {
      const { download_url } = await this.ticketsService.attachmentDownloadUrl(att.id);
      const a = document.createElement('a');
      a.href = download_url;
      a.download = att.original_filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      this.toast.error('Could not download the file. Please try again.');
    } finally {
      this.downloading.set(false);
    }
  }

  goBack(): void {
    void this.router.navigate(['/support']);
  }

  fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatSize(bytes: string): string {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }
}

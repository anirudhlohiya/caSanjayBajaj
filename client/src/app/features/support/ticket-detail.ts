import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TicketsService } from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import {
  Ticket,
  TicketAttachment,
  TICKET_STATUS_COLORS,
  TICKET_CATEGORY_LABELS,
} from '../../core/models';
import { PageHeader } from '../../shared/components/page-header';
import { Spinner } from '../../shared/components/spinner';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [PageHeader, Spinner],
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
    if (!t) return;
    await this.ticketsService.close(t.id);
    this.toast.success('Ticket closed');
    await this.load(t.id);
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

  hasAttachments(t: Ticket): boolean {
    return (t.messages ?? []).some(
      (m) => m.attachments && m.attachments.length > 0,
    );
  }

  firstMessage(t: Ticket): { message: string; created_at: string } | null {
    const m = (t.messages ?? [])[0];
    return m ? { message: m.message, created_at: m.created_at } : null;
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

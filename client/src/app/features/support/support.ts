import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TicketsService } from '../../core/services/feature.services';
import { Ticket, TICKET_STATUS_COLORS, TICKET_CATEGORY_LABELS } from '../../core/models';
import { PageHeader } from '../../shared/components/page-header';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [RouterLink, PageHeader, Spinner, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './support.html',
})
export class Support implements OnInit {
  private readonly ticketsService = inject(TicketsService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly tickets = signal<Ticket[]>([]);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly statusFilter = signal<string>('');

  readonly statusColors = TICKET_STATUS_COLORS;
  readonly categoryLabels = TICKET_CATEGORY_LABELS;

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.ticketsService.list({
        page: this.page(),
        pageSize: this.pageSize(),
        status: this.statusFilter() || undefined,
      });
      this.tickets.set(res.items);
      this.total.set(res.total);
      this.totalPages.set(res.totalPages);
    } finally {
      this.loading.set(false);
    }
  }

  filterByStatus(status: string): void {
    this.statusFilter.set(status);
    this.page.set(1);
    void this.load();
  }

  pageChanged(p: number): void {
    this.page.set(p);
    void this.load();
  }

  openTicket(id: string): void {
    void this.router.navigate(['/support', id]);
  }

  fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}

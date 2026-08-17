import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { AuditService } from '../../core/services/feature.services';
import { AuditLog } from '../../core/models';
import { PageHeader } from '../../shared/components/page-header';
import { Pagination } from '../../shared/components/pagination';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [JsonPipe, PageHeader, Pagination, Spinner, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit.html',
})
export class Audit implements OnInit {
  private readonly auditService = inject(AuditService);

  readonly loading = signal(true);
  readonly logs = signal<AuditLog[]>([]);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly actionFilter = signal('');

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.auditService.list({
        page: this.page(),
        pageSize: this.pageSize(),
        action: this.actionFilter() || undefined,
      });
      this.logs.set(res.items);
      this.total.set(res.total);
      this.totalPages.set(res.totalPages);
    } finally {
      this.loading.set(false);
    }
  }

  applyFilter(): void {
    this.page.set(1);
    void this.load();
  }

  pageChanged(p: number): void {
    this.page.set(p);
    void this.load();
  }

  actionLabel(action: string): string {
    return action.replace('.', ' · ');
  }

  fmtDate(iso: string): string {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
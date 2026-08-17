import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from '../../core/services/toast.service';
import { NotificationsService } from '../../core/services/feature.services';
import { ReportNotification } from '../../core/models';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';
import { PageHeader } from '../../shared/components/page-header';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [Spinner, EmptyState, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notifications.html',
})
export class Notifications {
  private readonly notificationsService = inject(NotificationsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly items = signal<ReportNotification[]>([]);
  readonly hasUnread = signal(false);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.notificationsService.list({ pageSize: 50 });
      this.items.set(result.items);
      this.hasUnread.set(result.items.some((n) => !n.is_read));
    } catch {
      this.items.set([]);
      this.hasUnread.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  async markAllRead(): Promise<void> {
    try {
      await this.notificationsService.markAllRead();
      this.items.update((list) => list.map((n) => ({ ...n, is_read: true })));
      this.hasUnread.set(false);
      this.toast.success('All notifications marked as read.');
    } catch {
      /* toast handled by interceptor */
    }
  }

  async open(item: ReportNotification): Promise<void> {
    if (!item.is_read) {
      item.is_read = true;
      this.items.update((list) =>
        list.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)),
      );
      this.hasUnread.set(this.items().some((n) => !n.is_read));
      try {
        await this.notificationsService.markRead(item.id);
      } catch {
        /* non-fatal */
      }
    }
    if (item.deep_link) {
      await this.router.navigateByUrl(item.deep_link);
    }
  }

  timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }
}
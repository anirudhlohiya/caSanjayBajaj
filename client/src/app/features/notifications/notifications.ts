import {
  ChangeDetectionStrategy,
  Component,
  computed,
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

const PAGE_SIZE = 20;

/** Icon and tint for a notification, from the screen it opens (the API has no type field). */
export function notificationKind(link: string | null): { icon: string; tone: 'ok' | 'brand' | 'gold' } {
  const path = link ?? '';
  if (path.startsWith('/support')) return { icon: 'support_agent', tone: 'ok' };
  if (path.startsWith('/reports')) return { icon: 'summarize', tone: 'gold' };
  if (/^\/(documents|upload)/.test(path)) return { icon: 'description', tone: 'brand' };
  if (/^\/(due-dates|reminders)/.test(path)) return { icon: 'event_upcoming', tone: 'brand' };
  return { icon: 'notifications', tone: 'brand' };
}

/** Splits a newest-first list into Today and Earlier (local time). */
export function groupByDay<T extends { created_at: string }>(items: T[], now = new Date()): { label: string; items: T[] }[] {
  const today = now.toDateString();
  const groups = [
    { label: 'Today', items: items.filter((i) => new Date(i.created_at).toDateString() === today) },
    { label: 'Earlier', items: items.filter((i) => new Date(i.created_at).toDateString() !== today) },
  ];
  return groups.filter((g) => g.items.length > 0);
}

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
  readonly page = signal(1);
  readonly totalPages = signal(1);
  readonly total = signal(0);
  readonly groups = computed(() => groupByDay(this.items()));
  readonly kind = notificationKind;
  readonly hasUnread = computed(
    () => this.notificationsService.unreadCount() > 0,
  );

  constructor() {
    void this.load();
  }

  async load(page = this.page()): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.notificationsService.list({
        page,
        pageSize: PAGE_SIZE,
      });
      this.items.set(result.items);
      this.page.set(result.page);
      this.totalPages.set(Math.max(result.totalPages, 1));
      this.total.set(result.total);
      void this.notificationsService.refreshUnread();
    } catch {
      this.items.set([]);
      this.totalPages.set(1);
      this.total.set(0);
    } finally {
      this.loading.set(false);
    }
  }

  async prev(): Promise<void> {
    if (this.page() <= 1) return;
    await this.load(this.page() - 1);
  }

  async next(): Promise<void> {
    if (this.page() >= this.totalPages()) return;
    await this.load(this.page() + 1);
  }

  async markAllRead(): Promise<void> {
    try {
      await this.notificationsService.markAllRead();
      this.items.update((list) => list.map((n) => ({ ...n, is_read: true })));
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
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { NotificationsService } from '../../core/services/feature.services';
import { NavEntry, resolveNav } from '../../core/services/nav-map';
import { NavHistoryService } from '../../core/services/nav-history.service';
import { PushService } from '../../core/services/push.service';
import { ThemeService } from '../../core/services/theme.service';
import { UploadQueueService } from '../../core/services/upload-queue.service';
import { UploadService } from '../../core/services/upload.service';
import { ToastContainer } from '../../shared/components/toast-container';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastContainer, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
})
export class Shell implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly router = inject(Router);
  readonly online = signal(navigator.onLine);
  readonly notificationDenied = signal(false);

  /** Title/subtitle/back-button definition for the current route. */
  private readonly navEntry = signal<NavEntry>(resolveNav(this.router.url));
  readonly header = this.navEntry.asReadonly();
  readonly canGoBack = computed(() => this.navEntry().backTo !== null);
  readonly headerParams = computed<Record<string, string>>(() => ({
    name: this.firstName(),
  }));

  private readonly navSub = new Subscription();
  private readonly navHistory = inject(NavHistoryService);

  // Inject ThemeService to initialize theming on shell load
  private readonly themeService = inject(ThemeService);
  readonly push = inject(PushService);
  private readonly queue = inject(UploadQueueService);
  private readonly upload = inject(UploadService);
  private readonly notifications = inject(NotificationsService);
  readonly unreadCount = this.notifications.unreadCount;

  readonly navItems = [
    { label: 'Home', icon: 'home', route: '/dashboard', labelKey: 'NAV.HOME' },
    { label: 'Services', icon: 'grid_view', route: '/services', labelKey: 'NAV.SERVICES' },
    { label: 'Documents', icon: 'description', route: '/documents', labelKey: 'NAV.DOCUMENTS' },
    { label: 'Reminders', icon: 'calendar_month', route: '/reminders', labelKey: 'NAV.REMINDERS' },
    { label: 'Profile', icon: 'person', route: '/profile', labelKey: 'NAV.PROFILE' },
  ];

  constructor() {
    window.addEventListener('online', () => {
      this.online.set(true);
      void this.flushQueue();
    });
    window.addEventListener('offline', () => {
      this.online.set(false);
    });
  }

  async ngOnInit(): Promise<void> {
    if (!this.auth.profileLoaded()) {
      try {
        await this.auth.loadProfile();
      } catch {
        /* interceptor handles 401 */
      }
    }
    void this.push.init();
    void this.flushQueue();
    this.checkNotificationPermission();
    void this.notifications.refreshUnread();

    this.navSub.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe((e) => {
          this.navEntry.set(resolveNav(e.urlAfterRedirects));
          void this.notifications.refreshUnread();
        }),
    );
    // Pick up alerts that arrive while the app is open (or when it is refocused)
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') {
        void this.notifications.refreshUnread();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    this.navSub.add(() =>
      document.removeEventListener('visibilitychange', onVisible),
    );
  }

  ngOnDestroy(): void {
    this.navSub.unsubscribe();
  }

  /** Back action for the top bar: the previous page, else the logical parent. */
  goBack(): void {
    this.navHistory.back();
  }

  firstName(): string {
    return this.auth.userProfile()?.name?.trim().split(/\s+/)[0] ?? '';
  }

  /** Banner when notifications are blocked (browser or Android app). */
  checkNotificationPermission(): void {
    this.notificationDenied.set(this.push.blocked());
  }

  /** Answer from the post-sign-in "Turn on notifications" sheet (Android app). */
  async answerPushPrompt(allow: boolean): Promise<void> {
    await this.push.answerPrompt(allow);
    this.checkNotificationPermission();
  }

  private async flushQueue(): Promise<void> {
    const pending = await this.queue.list();
    if (pending.length === 0 || !navigator.onLine) return;
    await this.upload.processQueue();
  }

  initials(): string {
    const name = this.auth.userProfile()?.name;
    if (!name) return '?';
    return name
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }
}
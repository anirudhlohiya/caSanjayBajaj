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
import { NavEntry, resolveNav } from '../../core/services/nav-map';
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

  // Inject ThemeService to initialize theming on shell load
  private readonly themeService = inject(ThemeService);
  private readonly push = inject(PushService);
  private readonly queue = inject(UploadQueueService);
  private readonly upload = inject(UploadService);

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

    this.navSub.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe((e) => this.navEntry.set(resolveNav(e.urlAfterRedirects))),
    );
  }

  ngOnDestroy(): void {
    this.navSub.unsubscribe();
  }

  /**
   * Back action for the top bar. Always `replaceUrl` so the parent is not left
   * in the history stack twice — otherwise the browser (or the Android WebView's
   * own back handling) would return the user here on the next back press.
   */
  goBack(): void {
    const parent = this.navEntry().backTo;
    if (!parent) return;
    void this.router.navigateByUrl(parent, { replaceUrl: true });
  }

  firstName(): string {
    return this.auth.userProfile()?.name?.trim().split(/\s+/)[0] ?? '';
  }

  checkNotificationPermission(): void {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'denied') {
      this.notificationDenied.set(true);
    } else if (Notification.permission === 'default') {
      // Show banner only if not granted (not denied - that's a different message)
      this.notificationDenied.set(false);
    }
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
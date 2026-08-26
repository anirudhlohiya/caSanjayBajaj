import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PushService } from '../../core/services/push.service';
import { ThemeService } from '../../core/services/theme.service';
import { UploadQueueService } from '../../core/services/upload-queue.service';
import { UploadService } from '../../core/services/upload.service';
import { ToastContainer } from '../../shared/components/toast-container';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastContainer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
})
export class Shell implements OnInit {
  readonly auth = inject(AuthService);
  readonly router = inject(Router);
  readonly online = signal(navigator.onLine);
  readonly notificationDenied = signal(false);

  // Inject ThemeService to initialize theming on shell load
  private readonly themeService = inject(ThemeService);
  private readonly push = inject(PushService);
  private readonly queue = inject(UploadQueueService);
  private readonly upload = inject(UploadService);

  readonly navItems = [
    { label: 'Home', icon: 'home', route: '/dashboard' },
    { label: 'Documents', icon: 'folder_copy', route: '/documents' },
    { label: 'Reports', icon: 'description', route: '/reports' },
    { label: 'Support', icon: 'support_agent', route: '/support' },
    { label: 'Profile', icon: 'person', route: '/profile' },
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
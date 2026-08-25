import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  show: () => boolean;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styles: [':host { display: flex; width: 100%; height: 100%; }'],
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;
  readonly collapsed = signal(false);
  readonly mobileOpen = signal(false);

  private readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'dashboard', show: () => true },
    { label: 'Clients', route: '/clients', icon: 'groups', show: () => this.auth.hasPermission('view_clients') },
    { label: 'Documents', route: '/documents', icon: 'description', show: () => this.auth.hasPermission('view_documents') },
    { label: 'Reports', route: '/reports', icon: 'assessment', show: () => this.auth.hasPermission('upload_reports') },
    { label: 'Reminders', route: '/reminders', icon: 'notifications_active', show: () => this.auth.hasPermission('send_reminders') },
    { label: 'Staff', route: '/staff', icon: 'badge', show: () => this.auth.isSuperAdmin() },
    { label: 'Website', route: '/website', icon: 'language', show: () => this.auth.hasPermission('manage_website') },
    { label: 'Audit Logs', route: '/audit', icon: 'history', show: () => this.auth.hasPermission('view_audit_logs') },
    { label: 'Settings', route: '/settings', icon: 'settings', show: () => this.auth.hasPermission('manage_settings') },
  ];

  readonly visibleNav = computed(() => this.navItems.filter((n) => n.show()));

  get userName(): string {
    return this.user()?.email ?? 'Admin';
  }

  get userInitials(): string {
    const email = this.user()?.email ?? 'A';
    return email.slice(0, 2).toUpperCase();
  }

  toggleSidebar(): void {
    this.collapsed.update((c) => !c);
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TicketsService, WhatsappChatsService } from '../../core/services/feature.services';
import { ThemeMode, ThemeService } from '../../core/services/theme.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  show: () => boolean;
  /** Gold count next to the item (open tickets, chats needing attention). */
  count?: () => number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styles: [':host { display: flex; width: 100%; height: 100%; }'],
})
export class Shell implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly tickets = inject(TicketsService);
  private readonly whatsapp = inject(WhatsappChatsService);
  readonly theme = inject(ThemeService);

  readonly user = this.auth.currentUser;
  readonly collapsed = signal(false);
  readonly mobileOpen = signal(false);
  readonly openTickets = signal(0);
  readonly chatsNeedingAttention = signal(0);

  readonly themeOptions: { value: ThemeMode; icon: string; label: string }[] = [
    { value: 'light', icon: 'light_mode', label: 'Light' },
    { value: 'dark', icon: 'dark_mode', label: 'Dark' },
    { value: 'system', icon: 'brightness_auto', label: 'Match my computer' },
  ];

  private readonly groups: NavGroup[] = [
    { label: 'Overview', items: [{ label: 'Dashboard', route: '/dashboard', icon: 'dashboard', show: () => true }] },
    {
      label: 'Clients & work',
      items: [
        { label: 'Clients', route: '/clients', icon: 'groups', show: () => this.auth.hasPermission('view_clients') },
        { label: 'Documents', route: '/documents', icon: 'description', show: () => this.auth.hasPermission('view_documents') },
        { label: 'Reports', route: '/reports', icon: 'assessment', show: () => this.auth.hasPermission('view_reports') },
        { label: 'Reminders', route: '/reminders', icon: 'notifications_active', show: () => this.auth.hasPermission('send_reminders') },
      ],
    },
    {
      label: 'Tickets & chats',
      items: [
        { label: 'Tickets', route: '/tickets', icon: 'support_agent', show: () => this.auth.hasPermission('manage_tickets'), count: () => this.openTickets() },
        { label: 'WhatsApp Chats', route: '/whatsapp-chats', icon: 'chat', show: () => this.auth.hasPermission('manage_whatsapp'), count: () => this.chatsNeedingAttention() },
      ],
    },
    {
      label: 'Website & app content',
      items: [
        { label: 'Website', route: '/website', icon: 'language', show: () => this.auth.hasPermission('manage_website') },
        { label: 'Services', route: '/services', icon: 'home_repair_service', show: () => this.auth.hasPermission('manage_website') },
        { label: 'Due Dates', route: '/due-dates', icon: 'event', show: () => this.auth.hasPermission('manage_website') },
        { label: 'FAQs', route: '/faqs', icon: 'quiz', show: () => this.auth.hasPermission('manage_website') },
      ],
    },
    {
      label: 'Tools',
      items: [{ label: 'Rent Agreements', route: '/rent-agreements', icon: 'contract', show: () => this.auth.hasPermission('manage_rent_agreements') }],
    },
    {
      label: 'Admin',
      items: [
        { label: 'Staff', route: '/staff', icon: 'badge', show: () => this.auth.isSuperAdmin() },
        { label: 'Audit Logs', route: '/audit', icon: 'history', show: () => this.auth.hasPermission('view_audit_logs') },
        { label: 'Settings', route: '/settings', icon: 'settings', show: () => this.auth.hasPermission('manage_settings') },
      ],
    },
  ];

  /** Groups with only the items this person may open; empty groups are dropped. */
  readonly visibleGroups = computed(() =>
    this.groups
      .map((g) => ({ label: g.label, items: g.items.filter((i) => i.show()) }))
      .filter((g) => g.items.length > 0),
  );

  ngOnInit(): void {
    void this.loadCounts();
  }

  /** Sidebar counts: one small request each, only for pages this person can open. Failures just hide the count. */
  async loadCounts(): Promise<void> {
    if (this.auth.hasPermission('manage_tickets')) {
      this.tickets
        .list({ status: 'open', page: 1, pageSize: 1 })
        .then((r) => this.openTickets.set(r.total))
        .catch(() => this.openTickets.set(0));
    }
    if (this.auth.hasPermission('manage_whatsapp')) {
      Promise.all(
        ['staff_takeover', 'escalated'].map((status) =>
          this.whatsapp.listConversations({ status, limit: 1 }).then((r) => r.total),
        ),
      )
        .then(([a, b]) => this.chatsNeedingAttention.set(a + b))
        .catch(() => this.chatsNeedingAttention.set(0));
    }
  }

  get userName(): string {
    return this.user()?.email ?? 'Admin';
  }

  get userInitials(): string {
    const email = this.user()?.email ?? 'A';
    return email.slice(0, 2).toUpperCase();
  }

  get roleLabel(): string {
    return this.auth.isSuperAdmin() ? 'Super admin' : 'Staff';
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

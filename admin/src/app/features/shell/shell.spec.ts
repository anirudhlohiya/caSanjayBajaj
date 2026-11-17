import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { TicketsService, WhatsappChatsService } from '../../core/services/feature.services';
import { Shell } from './shell';

describe('Shell sidebar', () => {
  function make(perms: string[], superAdmin = false) {
    const auth = {
      currentUser: signal({ email: 'staff@example.com' }),
      hasPermission: (p: string) => perms.includes(p),
      isSuperAdmin: () => superAdmin,
      logout: () => undefined,
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: TicketsService, useValue: { list: () => Promise.resolve({ total: 4 }) } },
        { provide: WhatsappChatsService, useValue: { listConversations: () => Promise.resolve({ total: 2 }) } },
      ],
    });
    return TestBed.runInInjectionContext(() => new Shell());
  }

  it('shows only allowed items and drops empty groups', () => {
    const shell = make(['view_clients']);
    const groups = shell.visibleGroups();
    expect(groups.map((g) => g.label)).toEqual(['Overview', 'Clients & work']);
    expect(groups[1].items.map((i) => i.label)).toEqual(['Clients']);
  });

  it('loads counts only for pages the person can open', async () => {
    const shell = make(['manage_tickets']);
    await shell.loadCounts();
    await Promise.resolve();
    await Promise.resolve();
    expect(shell.openTickets()).toBe(4);
    expect(shell.chatsNeedingAttention()).toBe(0);
  });
});

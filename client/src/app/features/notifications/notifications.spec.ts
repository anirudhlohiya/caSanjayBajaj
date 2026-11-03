import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Notifications, groupByDay, notificationKind } from './notifications';

describe('notificationKind', () => {
  it('picks the icon from the screen the notification opens', () => {
    expect(notificationKind('/support/42')).toEqual({ icon: 'support_agent', tone: 'ok' });
    expect(notificationKind('/reports')).toEqual({ icon: 'summarize', tone: 'gold' });
    expect(notificationKind('/documents/upload')).toEqual({ icon: 'description', tone: 'brand' });
    expect(notificationKind('/due-dates')).toEqual({ icon: 'event_upcoming', tone: 'brand' });
    expect(notificationKind(null)).toEqual({ icon: 'notifications', tone: 'brand' });
  });
});

describe('groupByDay', () => {
  const now = new Date(2026, 10, 3, 15, 0);
  it('splits into Today and Earlier and drops empty groups', () => {
    const items = [
      { id: 'a', created_at: new Date(2026, 10, 3, 9, 0).toISOString() },
      { id: 'b', created_at: new Date(2026, 9, 23, 9, 0).toISOString() },
    ];
    expect(groupByDay(items, now).map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['Today', ['a']],
      ['Earlier', ['b']],
    ]);
    expect(groupByDay([items[1]], now).map((g) => g.label)).toEqual(['Earlier']);
  });
});

/** Integration: real NotificationsService + HttpClient, only the server is faked. */
describe('Notifications screen', () => {
  let http: HttpTestingController;
  const page = (items: object[]) => ({ items, total: items.length, page: 1, pageSize: 20, totalPages: 1 });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Notifications],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render(items: object[]) {
    const fixture = TestBed.createComponent(Notifications);
    fixture.detectChanges();
    http.expectOne((r) => r.url.includes('/me/notifications?') && r.url.includes('pageSize=20')).flush(page(items));
    await fixture.whenStable();
    http.match((r) => r.url.includes('unread_only=true')).forEach((r) => r.flush(page([{}])));
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('groups notifications, marks unread ones with a dot and shows older dates in full', async () => {
    const fixture = await render([
      { id: '1', title: 'Your ticket has been resolved', body: 'Closed.', deep_link: '/support/1', is_read: false, created_at: new Date().toISOString() },
      { id: '2', title: 'Documents due for GST filing', body: 'Upload by 11 Nov.', deep_link: '/documents', is_read: true, created_at: '2026-10-23T05:00:00Z' },
    ]);
    const el: HTMLElement = fixture.nativeElement;
    expect(Array.from(el.querySelectorAll('h2')).map((h) => h.textContent?.trim())).toEqual(['Today', 'Earlier']);
    expect(el.querySelectorAll('[aria-label=Unread]').length).toBe(1);
    expect(el.textContent).toContain('23 Oct 2026');
    expect(el.textContent).toContain('Mark all read');
  });

  it('opening an unread notification marks it read on the server, then goes to its screen', async () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    const fixture = await render([
      { id: '7', title: 'Report ready', body: '', deep_link: '/reports', is_read: false, created_at: new Date().toISOString() },
    ]);
    (fixture.nativeElement.querySelector('.card button') as HTMLButtonElement).click();
    const req = http.expectOne((r) => r.url.endsWith('/me/notifications/7/read'));
    expect(req.request.method).toBe('POST');
    req.flush({});
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/reports');
  });

  it('shows the empty state when there is nothing', async () => {
    const fixture = await render([]);
    expect(fixture.nativeElement.textContent).toContain('No notifications');
  });
});

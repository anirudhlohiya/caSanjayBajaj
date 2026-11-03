import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import {
  DueDatesService,
  ReportsService,
  ServicesOfferedService,
} from '../../core/services/feature.services';
import { Dashboard } from './dashboard';

function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const row = (id: string, title: string, days: number, audiences: string[], category = 'gst') => ({
  id,
  title,
  form: null,
  category,
  due_date: inDays(days),
  original_due_date: null,
  period_label: 'October 2026',
  description: '',
  audiences,
  fy: '2026-27',
});

describe('Home screen', () => {
  let dueDates: jasmine.SpyObj<DueDatesService>;
  const profile = signal<{ name: string; user_type: string; gst_filing_frequency?: string } | null>(null);

  async function render() {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    // The banner rotates on a timer, so the zone never settles: stop it, then let the loads finish.
    fixture.componentInstance.ngOnDestroy();
    for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    profile.set({ name: 'Sanjay Bajaj', user_type: 'general' });
    dueDates = jasmine.createSpyObj<DueDatesService>('DueDatesService', ['list']);
    const services = jasmine.createSpyObj<ServicesOfferedService>('ServicesOfferedService', ['listActive']);
    services.listActive.and.resolveTo([
      { id: '1', slug: 'gst', title: 'GST Services', icon: 'receipt_long', tags: ['Registration'], description: '' },
    ] as never);
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { userProfile: profile } },
        { provide: DueDatesService, useValue: dueDates },
        { provide: ReportsService, useValue: jasmine.createSpyObj('ReportsService', ['list']) },
        { provide: ServicesOfferedService, useValue: services },
      ],
    }).compileComponents();
  });

  it('shows the nearest upcoming deadline in the Next due card', async () => {
    dueDates.list.and.resolveTo([
      row('later', 'GSTR-3B', 17, ['gst_all']),
      row('past', 'Old one', -3, ['all']),
      row('soon', 'TDS / TCS deposit', 4, ['tds'], 'tds'),
    ] as never);
    const el = await render();
    const card = el.querySelector('[aria-labelledby=next-due-title]')!;
    expect(card.textContent).toContain('TDS / TCS deposit');
    expect(card.textContent).toContain('Next due · TDS / TCS');
    expect(card.textContent).toContain('4 days left');
    expect(card.querySelector('a')?.getAttribute('href')).toBe('/due-dates');
  });

  it("only counts deadlines that apply to the client's profile", async () => {
    profile.set({ name: 'Sanjay', user_type: 'itr' });
    dueDates.list.and.resolveTo([
      row('gst', 'GSTR-1', 1, ['gst_all']),
      row('itr', 'ITR filing', 20, ['itr_individual'], 'income_tax'),
    ] as never);
    const el = await render();
    expect(el.querySelector('#next-due-title')?.textContent).toContain('ITR filing');
  });

  it('says "Due today" on the day and hides the card when nothing is left', async () => {
    dueDates.list.and.resolveTo([row('t', 'GSTR-1', 0, ['all'])] as never);
    let el = await render();
    expect(el.textContent).toContain('Due today');

    dueDates.list.and.rejectWith(new Error('offline'));
    el = await render();
    expect(el.querySelector('#next-due-title')).toBeNull();
  });

  it('keeps the shortcuts, quick tools and services', async () => {
    dueDates.list.and.resolveTo([] as never);
    const el = await render();
    const text = el.textContent ?? '';
    for (const label of ['Due Date', 'Upload', 'Talk to', 'Contact', 'Check GST Number', 'FAQs', 'GST Services', 'Why Choose Us?']) {
      expect(text).toContain(label);
    }
  });
});

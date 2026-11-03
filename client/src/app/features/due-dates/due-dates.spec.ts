import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/services/auth.service';
import { DueDatesService } from '../../core/services/feature.services';
import { DueDates } from './due-dates';

function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const row = (id: string, title: string, days: number, category: string, audiences: string[], extra = {}) => ({
  id, title, form: null, category, due_date: inDays(days), original_due_date: null,
  period_label: null, description: '', audiences, fy: '', ...extra,
});

describe('Due date calendar screen', () => {
  const profile = signal<{ user_type: string; gst_filing_frequency?: string } | null>(null);

  beforeEach(async () => {
    profile.set({ user_type: 'gst', gst_filing_frequency: 'monthly' });
    await TestBed.configureTestingModule({
      imports: [DueDates],
      providers: [
        { provide: AuthService, useValue: { userProfile: profile } },
        {
          provide: DueDatesService,
          useValue: {
            list: async () => [
              row('tds', 'TDS / TCS deposit', 1, 'tds', ['tds']),
              row('g1', 'GSTR-1', 2, 'gst', ['gst_monthly'], { original_due_date: inDays(-1) }),
              row('itr', 'ITR (individual)', 3, 'income_tax', ['itr_individual']),
            ],
          },
        },
      ],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(DueDates);
    fixture.detectChanges();
    await fixture.componentInstance.load();
    fixture.detectChanges();
    return fixture;
  }

  it("marks today and lists what applies to a GST client, including extensions", async () => {
    const fixture = await render();
    const c = fixture.componentInstance;
    expect(c.grid().filter((d) => d.isToday).length).toBe(1);
    expect(c.upcoming().map((r) => r.id)).toEqual(['tds', 'g1']); // ITR (individual) is not for a GST-only client
    expect(fixture.nativeElement.textContent).toContain('Extended from');
  });

  it('turning off "For you" shows every deadline; the category filter narrows it', async () => {
    const fixture = await render();
    const c = fixture.componentInstance;
    c.personalised.set(false);
    expect(c.upcoming().map((r) => r.id)).toEqual(['tds', 'g1', 'itr']);
    c.category.set('income_tax');
    expect(c.visible().map((r) => r.id)).toEqual(['itr']);
  });
});

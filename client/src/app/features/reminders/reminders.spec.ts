import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/services/auth.service';
import { ComplianceTasksService } from '../../core/services/feature.services';
import { Reminders } from './reminders';

function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const period = (days: number) => ({ period_label: 'October 2026', due_date: inDays(days), schedule: null });

describe('Reminders screen', () => {
  let tasks: object[];

  beforeEach(async () => {
    tasks = [];
    await TestBed.configureTestingModule({
      imports: [Reminders],
      providers: [
        { provide: AuthService, useValue: { userProfile: signal({ gst_filing_frequency: 'monthly' }) } },
        { provide: ComplianceTasksService, useValue: { list: async () => tasks } },
      ],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(Reminders);
    fixture.detectChanges();
    await fixture.componentInstance.load();
    fixture.detectChanges();
    return fixture;
  }

  it('names returns properly instead of "Gstr 1"', () => {
    const c = TestBed.createComponent(Reminders).componentInstance;
    expect(c.taskLabel('gstr_1')).toBe('GSTR-1');
    expect(c.taskLabel('gstr_3b')).toBe('GSTR-3B');
    expect(c.taskLabel('gst_payment')).toBe('GST Payment');
    expect(c.taskLabel('tds_return_q3')).toBe('Tds Return Q3');
  });

  it('counts without leading zeros and folds completed reminders', async () => {
    tasks = [
      { id: 'a', category: 'gstr_1', status: 'pending', filing_period: period(8) },
      { id: 'b', category: 'gstr_3b', status: 'completed', filing_period: period(-20) },
      { id: 'c', category: 'iff', status: 'completed', filing_period: period(-50) },
    ];
    const fixture = await render();
    const el: HTMLElement = fixture.nativeElement;
    const counters = Array.from(el.querySelectorAll('.tabular-nums.text-\\[26px\\]')).map((n) => n.textContent?.trim());
    expect(counters).toEqual(['0', '1', '2']);
    expect(el.textContent).toContain('GSTR-1');
    expect(el.textContent).toContain('8 days');
    expect(el.textContent).not.toContain('GSTR-3B uploaded');

    const toggle = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Show 2 completed'))!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('GSTR-3B uploaded');
    expect(el.textContent).toContain('Hide completed');
  });

  it('shows the all-caught-up state when there is nothing', async () => {
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain("You're all caught up");
  });

  it('daysLeft hides past or missing dates', () => {
    const c = TestBed.createComponent(Reminders).componentInstance;
    expect(c.daysLeft({ filing_period: period(3) } as never)).toBe(3);
    expect(c.daysLeft({ filing_period: period(-1) } as never)).toBeNull();
    expect(c.daysLeft({} as never)).toBeNull();
  });
});

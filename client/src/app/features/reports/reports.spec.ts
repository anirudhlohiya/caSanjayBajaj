import { TestBed } from '@angular/core/testing';
import { PeriodsService, ReportRequestsService, ReportsService } from '../../core/services/feature.services';
import { Reports } from './reports';

const page = (items: object[]) => ({ items, total: items.length, page: 1, pageSize: 100, totalPages: 1 });
const sep = { id: 'p9', period_label: 'September 2026' };
const aug = { id: 'p8', period_label: 'August 2026' };

describe('Filing reports screen', () => {
  let reports: jasmine.SpyObj<ReportsService>;
  let requests: object[];

  beforeEach(async () => {
    requests = [];
    reports = jasmine.createSpyObj<ReportsService>('ReportsService', ['list', 'download' as never]);
    await TestBed.configureTestingModule({
      imports: [Reports],
      providers: [
        { provide: ReportsService, useValue: reports },
        { provide: ReportRequestsService, useValue: { list: async () => page(requests) } },
        { provide: PeriodsService, useValue: { list: async () => [sep, aug] } },
      ],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(Reports);
    fixture.detectChanges();
    await fixture.componentInstance.init();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('groups reports under their filing period, newest first', async () => {
    reports.list.and.resolveTo(
      page([
        { id: 'r1', report_type: 'gstr_3b', filing_period: sep, sent_at: '2026-10-12T06:00:00Z' },
        { id: 'r2', report_type: 'gstr_1', filing_period: sep, sent_at: '2026-10-11T06:00:00Z' },
        { id: 'r3', report_type: 'gstr_3b', filing_period: aug, sent_at: '2026-09-14T06:00:00Z' },
      ]) as never,
    );
    const el = await render();
    expect(Array.from(el.querySelectorAll('h2')).map((h) => h.textContent?.trim())).toEqual(['September 2026', 'August 2026']);
    const buttons = el.querySelectorAll('button[aria-label^=Download]');
    expect(buttons.length).toBe(3);
    expect(buttons[2].getAttribute('aria-label')).toContain('for August 2026');
    expect(el.textContent).toContain('Shared 12 Oct 2026');
  });

  it('shows pending report requests above the list', async () => {
    reports.list.and.resolveTo(page([]) as never);
    requests = [{ id: 'q1', status: 'pending', filing_period: sep }, { id: 'q2', status: 'fulfilled', filing_period: aug }];
    const el = await render();
    expect(el.textContent).toContain('Pending Report Requests');
    expect(el.textContent).toContain('September 2026');
    expect(el.textContent).not.toContain('August 2026 Delivered');
  });

  it('asks the API for one period when a period is picked', async () => {
    reports.list.and.resolveTo(page([]) as never);
    const el = await render();
    expect(el.textContent).toContain('No reports yet');
    await TestBed.createComponent(Reports).componentInstance.setPeriod('p8');
    expect(reports.list).toHaveBeenCalledWith({ filingPeriodId: 'p8', pageSize: 100 });
  });
});

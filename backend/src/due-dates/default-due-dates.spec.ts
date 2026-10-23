import { DEFAULT_DUE_DATES, DUE_DATE_AUDIENCES } from './default-due-dates';
import { currentFy } from './due-dates.service';

describe('FY 2026-27 default due dates', () => {
  it('only contains real dates inside the financial year', () => {
    for (const d of DEFAULT_DUE_DATES) {
      const date = new Date(`${d.due_date}T00:00:00Z`);
      expect(date.toISOString().slice(0, 10)).toBe(d.due_date);
      expect(d.due_date >= '2026-04-01' && d.due_date <= '2027-03-31').toBe(
        true,
      );
    }
  });

  it('uses known audiences only', () => {
    for (const d of DEFAULT_DUE_DATES) {
      expect(d.audiences.length).toBeGreaterThan(0);
      for (const a of d.audiences) expect(DUE_DATE_AUDIENCES).toContain(a);
    }
  });

  it('covers every month of the year for monthly GST and TDS deposits', () => {
    const months = (title: string) =>
      new Set(
        DEFAULT_DUE_DATES.filter((d) => d.title === title).map((d) =>
          d.due_date.slice(0, 7),
        ),
      ).size;
    expect(months('GSTR-3B (monthly)')).toBe(12);
    expect(months('GSTR-1 (monthly)')).toBe(12);
    // April's slot is the 30 April March-deposit row
    expect(months('TDS / TCS deposit')).toBe(11);
  });

  it('records the CBDT Circular 07/2026 extensions', () => {
    const audit = DEFAULT_DUE_DATES.find((d) => d.title === 'Tax audit report');
    expect(audit?.due_date).toBe('2026-10-21');
    expect(audit?.original_due_date).toBe('2026-09-30');
  });
});

describe('currentFy', () => {
  it('rolls over on 1 April', () => {
    expect(currentFy(new Date(2026, 2, 31))).toBe('2025-26');
    expect(currentFy(new Date(2026, 3, 1))).toBe('2026-27');
    expect(currentFy(new Date(2027, 0, 15))).toBe('2026-27');
  });
});

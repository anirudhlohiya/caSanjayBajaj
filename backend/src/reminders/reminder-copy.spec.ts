import { ComplianceCategory } from '../common/enums';
import { buildReminderCopy, formatDueDate } from './reminder-copy';

describe('formatDueDate', () => {
  it('formats YYYY-MM-DD as "D Month YYYY"', () => {
    expect(formatDueDate('2026-10-11')).toBe('11 October 2026');
  });

  it('round-trips a malformed date unchanged', () => {
    expect(formatDueDate('not-a-date')).toBe('not-a-date');
  });
});

describe('buildReminderCopy', () => {
  const base = {
    name: 'Amit',
    month: 'October 2026',
    due: '2026-10-11',
  };

  it('builds GSTR-1 day1 (5th) copy', () => {
    const { title, body } = buildReminderCopy({
      ...base,
      category: ComplianceCategory.GSTR_1,
      slot: 0,
    });
    expect(title).toBe('GST sales bills due — October 2026');
    expect(body).toContain('Dear Amit');
    expect(body).toContain('gentle reminder');
    expect(body).toContain('October 2026 sales bills (GSTR-1)');
    expect(body).toContain('11 October 2026');
  });

  it('builds GSTR-1 day2 (7th) copy', () => {
    const { body } = buildReminderCopy({
      ...base,
      category: ComplianceCategory.GSTR_1,
      slot: 1,
    });
    expect(body).toContain('still pending');
    expect(body).toContain('by 11 October 2026');
  });

  it('builds GSTR-1 last-day (11th) copy', () => {
    const { title, body } = buildReminderCopy({
      ...base,
      category: ComplianceCategory.GSTR_1,
      slot: 2,
    });
    expect(title).toBe('Last day to submit GSTR-1 — October 2026');
    expect(body).toContain('TODAY is the last day');
  });

  it('builds the monthly GSTR-3B copy', () => {
    const { body } = buildReminderCopy({
      ...base,
      category: ComplianceCategory.GSTR_3B,
      slot: 0,
      due: '2026-10-20',
    });
    expect(body).toContain('purchase bills (GSTR-3B)');
    expect(body).toContain('20 October 2026');
  });

  it('builds the quarterly GSTR-3B copy with {quarter}', () => {
    const { title, body } = buildReminderCopy({
      ...base,
      category: ComplianceCategory.GSTR_3B,
      slot: 0,
      quarter: 'Oct–Dec 2026',
      due: '2027-01-22',
    });
    expect(title).toBe('GSTR-3B purchase bills due — Oct–Dec 2026');
    expect(body).toContain('Oct–Dec 2026 purchase bills (GSTR-3B)');
    expect(body).toContain('22 January 2027');
    expect(body).not.toContain('October 2026 sales bills');
  });

  it('builds the IFF day1/day2/day3 copies', () => {
    const d1 = buildReminderCopy({
      ...base,
      category: ComplianceCategory.IFF,
      slot: 0,
    });
    expect(d1.body).toContain('gentle reminder');
    expect(d1.body).toContain('IFF sales summary');

    const d3 = buildReminderCopy({
      ...base,
      category: ComplianceCategory.IFF,
      slot: 2,
    });
    expect(d3.body).toContain("tap 'File Nil'");
  });

  it('falls back to a generic copy for payment/legacy categories', () => {
    const { body, title } = buildReminderCopy({
      ...base,
      category: ComplianceCategory.GST_PAYMENT,
      slot: 0,
    });
    expect(title).toContain('Documents due');
    expect(body).toContain('documents are due');
  });
});

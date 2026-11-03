import { daysUntil, fyOf, nextDue, relevantAudiences } from './due-date-meta';

describe('due-date-meta', () => {
  it('fyOf rolls over on 1 April', () => {
    expect(fyOf(new Date(2026, 2, 31))).toBe('2025-26');
    expect(fyOf(new Date(2026, 3, 1))).toBe('2026-27');
    expect(fyOf(new Date(2099, 11, 31))).toBe('2099-00');
  });

  it('daysUntil counts whole days, 0 on the day itself', () => {
    expect(daysUntil('2026-11-07', '2026-11-03')).toBe(4);
    expect(daysUntil('2026-11-03', '2026-11-03')).toBe(0);
    expect(daysUntil('2027-03-01', '2027-02-27')).toBe(2);
    expect(daysUntil('2026-11-01', '2026-11-03')).toBe(-2);
  });

  describe('nextDue', () => {
    const rows = [
      { id: 'gstr1', due_date: '2026-11-11', audiences: ['gst_all'] },
      { id: 'past', due_date: '2026-10-20', audiences: ['all'] },
      { id: 'tds', due_date: '2026-11-07', audiences: ['tds'] },
      { id: 'itr', due_date: '2026-11-30', audiences: ['itr_individual'] },
      { id: 'today', due_date: '2026-11-03', audiences: ['itr_individual'] },
    ];

    it('picks the earliest upcoming deadline for everyone when the profile says nothing', () => {
      expect(nextDue(rows, '2026-11-03', null)?.id).toBe('today');
    });

    it('skips deadlines that do not apply to the client', () => {
      const gstClient = relevantAudiences('gst', 'monthly');
      expect(nextDue(rows, '2026-11-03', gstClient)?.id).toBe('tds');
    });

    it('ignores past deadlines and returns null when nothing is left', () => {
      expect(nextDue(rows, '2026-12-01', null)).toBeNull();
    });

    it('does not depend on the order of the rows', () => {
      expect(nextDue([...rows].reverse(), '2026-11-04', null)?.id).toBe('tds');
    });
  });
});

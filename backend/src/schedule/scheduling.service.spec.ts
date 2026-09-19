import { SchedulingService } from './scheduling.service';
import { ComplianceCategory, GstFilingFrequency } from '../common/enums';

describe('SchedulingService', () => {
  let service: SchedulingService;

  beforeEach(() => {
    service = new SchedulingService();
  });

  describe('defaultScheduleForPeriodCode', () => {
    it('builds the full default schedule for a monthly period', () => {
      const s = service.defaultScheduleForPeriodCode('2026-10');
      expect(s.gstr1.due).toBe('2026-10-11');
      expect(s.gstr1.reminders).toEqual([
        '2026-10-05',
        '2026-10-07',
        '2026-10-11',
      ]);
      expect(s.gstr1.day_keys).toEqual(['day1', 'day2', 'day3']);
      expect(s.gstr3b.due).toBe('2026-10-20');
      expect(s.gstr3b.reminders).toEqual(['2026-10-18']);
      expect(s.iff.due).toBe('2026-10-13');
      expect(s.iff.reminders).toEqual([
        '2026-10-05',
        '2026-10-07',
        '2026-10-11',
      ]);
      expect(s.payment.due).toBe('2026-10-20');
      expect(s.payment.reminders).toEqual([]);
      expect(s.quarterly.gstr3b.quarter_label).toBe('Oct–Dec 2026');
      expect(s.quarterly.gstr3b.due).toBe('2027-01-22');
      expect(s.quarterly.gstr3b.reminders).toEqual(['2027-01-20']);
    });

    it('settles the Apr–Jun quarter in July', () => {
      const s = service.defaultScheduleForPeriodCode('2026-06');
      expect(s.quarterly.gstr3b.quarter_label).toBe('Apr–Jun 2026');
      expect(s.quarterly.gstr3b.due).toBe('2026-07-22');
      expect(s.quarterly.gstr3b.reminders).toEqual(['2026-07-20']);
      expect(s.gstr1.due).toBe('2026-06-11');
    });

    it('rolls the December quarter into the following January', () => {
      const s = service.defaultScheduleForPeriodCode('2026-12');
      expect(s.quarterly.gstr3b.quarter_label).toBe('Oct–Dec 2026');
      expect(s.quarterly.gstr3b.due).toBe('2027-01-22');
      expect(s.quarterly.gstr3b.reminders).toEqual(['2027-01-20']);
    });

    it('handles a leap February', () => {
      const s = service.defaultScheduleForPeriodCode('2028-02');
      expect(s.gstr1.due).toBe('2028-02-11');
      expect(s.gstr3b.due).toBe('2028-02-20');
      expect(s.iff.due).toBe('2028-02-13');
      expect(s.quarterly.gstr3b.due).toBe('2028-04-22');
    });
  });

  describe('quarterForPeriodCode', () => {
    it('marks quarter-end months (Mar/Jun/Sep/Dec)', () => {
      expect(service.quarterForPeriodCode('2026-03').endsQuarter).toBe(true);
      expect(service.quarterForPeriodCode('2026-06').endsQuarter).toBe(true);
      expect(service.quarterForPeriodCode('2026-09').endsQuarter).toBe(true);
      expect(service.quarterForPeriodCode('2026-12').endsQuarter).toBe(true);
    });

    it('does not mark mid-quarter months', () => {
      expect(service.quarterForPeriodCode('2026-10').endsQuarter).toBe(false);
      expect(service.quarterForPeriodCode('2026-01').endsQuarter).toBe(false);
      expect(service.quarterForPeriodCode('2026-08').endsQuarter).toBe(false);
    });

    it('computes the settling month after the quarter end', () => {
      expect(service.quarterForPeriodCode('2026-09').settling).toEqual({
        periodCode: '2026-10',
        year: 2026,
        month: 10,
      });
      expect(service.quarterForPeriodCode('2026-12').settling).toEqual({
        periodCode: '2027-01',
        year: 2027,
        month: 1,
      });
      expect(service.quarterForPeriodCode('2026-10').settling).toEqual({
        periodCode: '2027-01',
        year: 2027,
        month: 1,
      });
    });
  });

  describe('scheduleFor', () => {
    it('falls back to the default when a period has no stored schedule', () => {
      const s = service.scheduleFor({ period_code: '2026-10', schedule: null });
      expect(s.gstr1.due).toBe('2026-10-11');
    });

    it('uses an admin override when present', () => {
      const override = service.defaultScheduleForPeriodCode('2026-10');
      override.gstr1.due = '2026-10-13';
      const s = service.scheduleFor({
        period_code: '2026-10',
        schedule: override,
      });
      expect(s.gstr1.due).toBe('2026-10-13');
    });
  });

  describe('validateSchedule', () => {
    it('accepts a generated default schedule', () => {
      const s = service.defaultScheduleForPeriodCode('2026-10');
      expect(service.validateSchedule('2026-10', s)).toEqual([]);
    });

    it('flags a reminder outside its calendar month', () => {
      const s = service.defaultScheduleForPeriodCode('2026-10');
      s.gstr1.reminders = ['2026-11-05'];
      const problems = service.validateSchedule('2026-10', s);
      expect(problems).toContain(
        'gstr1.reminders should be in 2026-10 (got 2026-11-05)',
      );
    });

    it('flags a missing quarterly entry', () => {
      const s = service.defaultScheduleForPeriodCode('2026-10');
      delete (s as { quarterly?: unknown }).quarterly;
      const problems = service.validateSchedule('2026-10', s);
      expect(problems.some((p) => p.startsWith('quarterly.gstr3b'))).toBe(true);
    });
  });

  describe('periodLabel', () => {
    it('formats a month label', () => {
      expect(SchedulingService.periodLabel('2026-10')).toBe('October 2026');
    });
  });

  describe('remindersOn', () => {
    it('matches GSTR-1 day1 on the 5th for monthly filers', () => {
      const s = service.defaultScheduleForPeriodCode('2026-10');
      const matches = service.remindersOn('2026-10-05', s, '2026-10');
      expect(matches).toEqual([
        {
          category: ComplianceCategory.GSTR_1,
          cadence: GstFilingFrequency.MONTHLY,
          slot: 0,
          due: '2026-10-11',
          month: 'October 2026',
        },
        {
          category: ComplianceCategory.IFF,
          cadence: GstFilingFrequency.QUARTERLY,
          slot: 0,
          due: '2026-10-13',
          month: 'October 2026',
        },
      ]);
    });

    it('matches GSTR-1 day2 (7th) and day3 (11th) slots', () => {
      const s = service.defaultScheduleForPeriodCode('2026-10');
      const day2 = service.remindersOn('2026-10-07', s, '2026-10');
      expect(
        day2.some(
          (m) => m.category === ComplianceCategory.GSTR_1 && m.slot === 1,
        ),
      ).toBe(true);
      const last = service.remindersOn('2026-10-11', s, '2026-10');
      expect(
        last.some(
          (m) => m.category === ComplianceCategory.GSTR_1 && m.slot === 2,
        ),
      ).toBe(true);
    });

    it('matches the monthly GSTR-3B reminder on the 18th for monthly filers', () => {
      const s = service.defaultScheduleForPeriodCode('2026-10');
      const matches = service.remindersOn('2026-10-18', s, '2026-10');
      expect(
        matches.some(
          (m) =>
            m.category === ComplianceCategory.GSTR_3B &&
            m.cadence === GstFilingFrequency.MONTHLY &&
            m.slot === 0 &&
            m.due === '2026-10-20',
        ),
      ).toBe(true);
    });

    it('matches the quarterly GSTR-3B reminder in the settling month', () => {
      const s = service.defaultScheduleForPeriodCode('2026-12');
      const matches = service.remindersOn('2027-01-20', s, '2026-12');
      expect(
        matches.some(
          (m) =>
            m.category === ComplianceCategory.GSTR_3B &&
            m.cadence === GstFilingFrequency.QUARTERLY &&
            m.quarter === 'Oct–Dec 2026' &&
            m.slot === 0 &&
            m.due === '2027-01-22' &&
            m.month === 'December 2026',
        ),
      ).toBe(true);
    });

    it('returns no matches on a non-reminder date', () => {
      const s = service.defaultScheduleForPeriodCode('2026-10');
      expect(service.remindersOn('2026-10-02', s, '2026-10')).toEqual([]);
    });

    it('never emits a payment reminder (manual only)', () => {
      const s = service.defaultScheduleForPeriodCode('2026-10');
      expect(
        service
          .remindersOn('2026-10-20', s, '2026-10')
          .some((m) => m.category === ComplianceCategory.GST_PAYMENT),
      ).toBe(false);
    });

    it('respects an admin override schedule', () => {
      const s = service.defaultScheduleForPeriodCode('2026-10');
      s.gstr1.reminders = ['2026-10-04', '2026-10-08', '2026-10-14'];
      const matches = service.remindersOn('2026-10-08', s, '2026-10');
      expect(
        matches.some(
          (m) => m.category === ComplianceCategory.GSTR_1 && m.slot === 1,
        ),
      ).toBe(true);
    });
  });
});

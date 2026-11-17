import { FilingMonthDueDates1800000000010 as M } from '../database/migrations/1800000000010-FilingMonthDueDates';
import { SchedulingService } from './scheduling.service';

describe('FilingMonthDueDates migration', () => {
  it('moves in-period monthly dates to the filing month, rolling December over', () => {
    expect(M.nextMonth('2026-10-11')).toBe('2026-11-11');
    expect(M.nextMonth('2026-12-20')).toBe('2027-01-20');
  });

  it('turns an old in-month schedule into the new default and keeps quarterly as is', () => {
    const old = {
      gstr1: {
        due: '2026-10-11',
        reminders: ['2026-10-05', '2026-10-07', '2026-10-11'],
      },
      gstr3b: { due: '2026-10-20', reminders: ['2026-10-18'] },
      iff: { due: '2026-10-13', reminders: ['2026-10-05'] },
      payment: { due: '2026-10-20', reminders: [] },
      quarterly: { gstr3b: { due: '2027-01-22', reminders: ['2027-01-20'] } },
    };
    const shifted = M.shiftSchedule('2026-10', old as never) as typeof old;
    const fresh = new SchedulingService().defaultScheduleForPeriodCode(
      '2026-10',
    );
    expect(shifted.gstr1).toMatchObject({
      due: fresh.gstr1.due,
      reminders: fresh.gstr1.reminders,
    });
    expect(shifted.gstr3b).toMatchObject({
      due: fresh.gstr3b.due,
      reminders: fresh.gstr3b.reminders,
    });
    expect(shifted.payment.due).toBe(fresh.payment.due);
    expect(shifted.quarterly).toEqual(old.quarterly);
  });

  it('leaves a schedule that is already in the filing month alone', () => {
    const fresh = new SchedulingService().defaultScheduleForPeriodCode(
      '2026-10',
    );
    expect(M.shiftSchedule('2026-10', fresh as never)).toBeNull();
  });
});

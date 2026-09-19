import { Injectable } from '@nestjs/common';
import { ComplianceCategory, GstFilingFrequency } from '../common/enums';
import { PeriodSchedule, TaskSchedule } from '../common/types/gst-schedule';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Quarter metadata for a given filing period (month). */
export interface QuarterInfo {
  /** e.g. "Apr–Jun 2026" */
  label: string;
  /** true when the period is the last month of its quarter (Mar/Jun/Sep/Dec) */
  endsQuarter: boolean;
  /** The month that settles the quarter (period code of the month after the quarter end). */
  settling: { periodCode: string; year: number; month: number };
}

export interface PeriodMonth {
  year: number;
  month: number; // 1-12
  periodCode: string; // YYYY-MM
}

/** A single reminder that fires on a given date (docs/13 §5.2). */
export interface ReminderMatch {
  category: ComplianceCategory;
  /** Copy slot (0/1/2) → maps to day1/day2/day3 copy texts (§4). */
  slot: number;
  /** Category due date (YYYY-MM-DD) for the {dueDate} placeholder. */
  due: string;
  /** Period label for the {month} placeholder. */
  month: string;
  /** Quarter label for the {quarter} placeholder (quarterly GSTR-3B only). */
  quarter?: string;
  /** Which filer cadence this reminder targets (targets by category+period). */
  cadence: GstFilingFrequency;
}

@Injectable()
export class SchedulingService {
  /**
   * Validate that `periodCode` is a well-formed `YYYY-MM` string.
   */
  static parsePeriodCode(periodCode: string): PeriodMonth {
    const match = /^(\d{4})-(\d{2})$/.exec(periodCode);
    if (!match) throw new Error(`Invalid period code: ${periodCode}`);
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) {
      throw new Error(`Invalid period code: ${periodCode}`);
    }
    return { year, month, periodCode };
  }

  static periodLabel(periodCode: string, fallback = '…'): string {
    try {
      const p = SchedulingService.parsePeriodCode(periodCode);
      return `${MONTHS_FULL[p.month - 1]} ${p.year}`;
    } catch {
      return fallback;
    }
  }

  /**
   * Quarter metadata for a period code (GST quarters: Apr–Jun, Jul–Sep,
   * Oct–Dec, Jan–Mar).
   */
  quarterForPeriodCode(periodCode: string): QuarterInfo {
    const p = SchedulingService.parsePeriodCode(periodCode);
    const qIndex = Math.floor((p.month - 1) / 3); // 0..3
    const startMonth = qIndex * 3 + 1;
    const endMonth = startMonth + 2;
    const settlingMonth = endMonth === 12 ? 1 : endMonth + 1;
    const settlingYear = endMonth === 12 ? p.year + 1 : p.year;
    return {
      label: `${MONTHS[startMonth - 1]}–${MONTHS[endMonth - 1]} ${p.year}`,
      endsQuarter: p.month === endMonth,
      settling: {
        periodCode: `${settlingYear}-${String(settlingMonth).padStart(2, '0')}`,
        year: settlingYear,
        month: settlingMonth,
      },
    };
  }

  /**
   * The default annual schedule for a filing period, per docs/13 §3.2.
   * All dates live inside the period's own calendar month, except the
   * quarterly GSTR-3B which settles in the month after the quarter ends.
   */
  defaultScheduleForPeriodCode(periodCode: string): PeriodSchedule {
    const { year, month } = SchedulingService.parsePeriodCode(periodCode);
    const q = this.quarterForPeriodCode(periodCode);
    const pad = (d: number) => String(d).padStart(2, '0');
    const inPeriod = (day: number) => `${year}-${pad(month)}-${pad(day)}`;
    const inSettling = (day: number) =>
      `${q.settling.year}-${pad(q.settling.month)}-${pad(day)}`;

    return {
      gstr1: {
        due: inPeriod(11),
        reminders: [inPeriod(5), inPeriod(7), inPeriod(11)],
        day_keys: ['day1', 'day2', 'day3'],
      },
      gstr3b: {
        due: inPeriod(20),
        reminders: [inPeriod(18)],
      },
      iff: {
        due: inPeriod(13),
        reminders: [inPeriod(5), inPeriod(7), inPeriod(11)],
        day_keys: ['day1', 'day2', 'day3'],
      },
      payment: {
        due: inPeriod(20),
        reminders: [],
      },
      quarterly: {
        gstr3b: {
          quarter_label: q.label,
          due: inSettling(22),
          reminders: [inSettling(20)],
        },
      },
    };
  }

  /**
   * Resolve the effective schedule for a period row: admin overrides when
   * present, otherwise the computed default. Legacy/seed periods without a
   * stored schedule are treated as defaults so downstream logic never sees a
   * null schedule.
   */
  scheduleFor(period: {
    period_code: string;
    schedule: PeriodSchedule | null;
  }): PeriodSchedule {
    return (
      period.schedule ?? this.defaultScheduleForPeriodCode(period.period_code)
    );
  }

  /**
   * Validate an admin-provided schedule for `periodCode`. Dates must parse and
   * fall in the correct calendar month (category dates in the period month,
   * quarterly GSTR-3B dates in the settling month). Returns a list of problems
   * (empty = valid). Pure helper for the admin schedule editor (M6).
   */
  validateSchedule(periodCode: string, schedule: PeriodSchedule): string[] {
    const problems: string[] = [];
    const q = this.quarterForPeriodCode(periodCode);

    const checks: Array<[string, TaskSchedule | undefined, string]> = [
      ['gstr1', schedule.gstr1, `${periodCode}`],
      ['gstr3b', schedule.gstr3b, `${periodCode}`],
      ['iff', schedule.iff, `${periodCode}`],
      ['payment', schedule.payment, `${periodCode}`],
      [
        'quarterly.gstr3b',
        schedule.quarterly?.gstr3b,
        `${q.settling.periodCode}`,
      ],
    ];

    for (const [key, task, monthCode] of checks) {
      if (!task) {
        problems.push(`${key}: missing schedule entry`);
        continue;
      }
      if (!SchedulingService.isDateInMonth(task.due, monthCode)) {
        problems.push(`${key}.due should be in ${monthCode}`);
      }
      for (const r of task.reminders ?? []) {
        if (!SchedulingService.isDateInMonth(r, monthCode)) {
          problems.push(
            `${key}.reminders should be in ${monthCode} (got ${r})`,
          );
        }
      }
    }

    // Order sanity: reminder days must not come after the due date.
    const byDue = (a: TaskSchedule | undefined, b: TaskSchedule | undefined) =>
      a?.due != null && b?.due != null && a.due > b.due;
    if (byDue(schedule.gstr1, schedule.gstr3b)) {
      problems.push('gstr1.due should not be after gstr3b.due');
    }

    return problems;
  }

  /**
   * Which reminders fire on `date` (YYYY-MM-DD) for the given period schedule
   * (docs/13 §5.2). GSTR-1/IFF have up to 3 slots mapping to copy day1/2/3;
   * GSTR-3B and quarterly GSTR-3B each fire once. `payment.reminders` is always
   * empty — payment is manual-only, so it never matches.
   */
  remindersOn(
    date: string,
    schedule: PeriodSchedule,
    periodCode: string,
  ): ReminderMatch[] {
    const matches: ReminderMatch[] = [];
    const month = SchedulingService.periodLabel(periodCode);
    const scan = (
      task: TaskSchedule | undefined,
      category: ComplianceCategory,
      cadence: GstFilingFrequency,
      extra?: { quarter: string },
    ) => {
      if (!task) return;
      task.reminders.forEach((reminder, slot) => {
        if (reminder === date) {
          matches.push({
            category,
            cadence,
            slot,
            due: task.due,
            month,
            ...(extra ? { quarter: extra.quarter } : {}),
          });
        }
      });
    };

    scan(schedule.gstr1, ComplianceCategory.GSTR_1, GstFilingFrequency.MONTHLY);
    scan(
      schedule.gstr3b,
      ComplianceCategory.GSTR_3B,
      GstFilingFrequency.MONTHLY,
    );
    scan(schedule.iff, ComplianceCategory.IFF, GstFilingFrequency.QUARTERLY);
    if (schedule.quarterly) {
      scan(
        schedule.quarterly.gstr3b,
        ComplianceCategory.GSTR_3B,
        GstFilingFrequency.QUARTERLY,
        { quarter: schedule.quarterly.gstr3b.quarter_label },
      );
    }
    return matches;
  }

  private static isDateInMonth(date: string, periodCode: string): boolean {
    return new RegExp(`^${periodCode}-\\d{2}$`).test(date);
  }
}

/**
 * Shared GST filing schedule types (docs/13 §6.2).
 *
 * All dates are `YYYY-MM-DD` strings. A period schedule stores, per category,
 * the deadline and auto-reminder dates that the reminders engine (M2) reads.
 * `day_keys` keeps reminder copy stable when an admin moves a date
 * (day1 = copy slot 1, day2 = copy slot 2, day3 = copy slot 3).
 */
export interface TaskSchedule {
  due: string;
  reminders: string[];
  day_keys?: string[];
}

export interface QuarterlyGstr3bSchedule extends TaskSchedule {
  quarter_label: string;
}

export interface PeriodSchedule {
  gstr1: TaskSchedule;
  gstr3b: TaskSchedule;
  iff: TaskSchedule;
  payment: TaskSchedule;
  quarterly: {
    gstr3b: QuarterlyGstr3bSchedule;
  };
}

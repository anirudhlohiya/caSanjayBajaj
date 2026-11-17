import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A filing period is the month of the sales / purchases: "October 2026" is
 * filed in November (GSTR-1 by 11 Nov, GSTR-3B by 20 Nov). Earlier code put
 * the monthly dates inside the period's own month (11 Oct / 20 Oct), so the
 * app disagreed with the due-date calendar.
 *
 * Moves forward by one month only dates that sit inside their own period
 * month; anything staff already set to a later month is left alone. The
 * quarterly GSTR-3B already settles after the quarter and is not touched.
 */
export class FilingMonthDueDates1800000000010 implements MigrationInterface {
  name = 'FilingMonthDueDates1800000000010';

  private static readonly MONTHLY_KEYS = ['gstr1', 'gstr3b', 'iff', 'payment'];

  /** '2026-10-11' → '2026-11-11' (days are 5–20, so no month-end overflow). */
  static nextMonth(date: string): string {
    const [y, m, d] = date.slice(0, 10).split('-').map(Number);
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    return `${ny}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  /** Shift in-period dates of the monthly entries; returns null when nothing moved. */
  static shiftSchedule(
    periodCode: string,
    schedule: Record<
      string,
      { due?: string; reminders?: string[] } | undefined
    >,
  ): Record<string, unknown> | null {
    const inPeriod = (d?: string) =>
      typeof d === 'string' && d.startsWith(periodCode);
    let moved = false;
    const out: Record<string, unknown> = { ...schedule };
    for (const key of FilingMonthDueDates1800000000010.MONTHLY_KEYS) {
      const task = schedule[key];
      if (!task || !inPeriod(task.due)) continue;
      moved = true;
      out[key] = {
        ...task,
        due: FilingMonthDueDates1800000000010.nextMonth(task.due!),
        reminders: (task.reminders ?? []).map((r) =>
          inPeriod(r) ? FilingMonthDueDates1800000000010.nextMonth(r) : r,
        ),
      };
    }
    return moved ? out : null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: {
      id: string;
      period_code: string;
      schedule: Record<string, never> | null;
    }[] = await queryRunner.query(
      `SELECT id, period_code, schedule FROM gst_filing_periods WHERE schedule IS NOT NULL`,
    );
    for (const row of rows) {
      const shifted = FilingMonthDueDates1800000000010.shiftSchedule(
        row.period_code,
        row.schedule!,
      );
      if (shifted) {
        await queryRunner.query(
          `UPDATE gst_filing_periods SET schedule = $1 WHERE id = $2`,
          [JSON.stringify(shifted), row.id],
        );
      }
    }

    await queryRunner.query(
      `UPDATE gst_filing_periods
          SET due_date = due_date + interval '1 month'
        WHERE to_char(due_date, 'YYYY-MM') = period_code`,
    );

    await queryRunner.query(
      `UPDATE compliance_tasks t
          SET due_date = t.due_date + interval '1 month'
         FROM gst_filing_periods p
        WHERE p.id = t.filing_period_id
          AND t.category IN ('gstr_1', 'gstr_3b', 'iff', 'gst_payment')
          AND t.due_date IS NOT NULL
          AND to_char(t.due_date, 'YYYY-MM') = p.period_code`,
    );
  }

  public async down(): Promise<void> {
    // shortcut: not reversible — after up() a moved date can't be told apart
    // from one that was already in the filing month. Restore from backup if needed.
  }
}

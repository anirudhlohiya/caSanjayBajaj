import { ComplianceCategory } from '../common/enums';

/**
 * Reminder message copy per docs/13 §4. Pure helpers, unit-testable.
 * All text is owned here so email + push stay identical.
 */

export interface ReminderCopyInput {
  category: ComplianceCategory;
  /** Copy slot: 0/1/2 → day1/day2/day3 for GSTR-1 & IFF; 0 for GSTR-3B. */
  slot: number;
  name: string;
  month: string;
  quarter?: string;
  due: string; // YYYY-MM-DD
}

export interface ReminderCopy {
  title: string;
  body: string;
}

const MONTHS = [
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

/** "2026-10-11" → "11 October 2026" */
export function formatDueDate(date: string): string {
  const [year, month, day] = date.split('-');
  const m = Number(month);
  const d = Number(day);
  if (!MONTHS[m - 1]) return date;
  return `${d} ${MONTHS[m - 1]} ${year}`;
}

export function buildReminderCopy(input: ReminderCopyInput): ReminderCopy {
  const { category, slot, name, month, quarter, due } = input;
  const dueDate = formatDueDate(due);
  const greeting = `Dear ${name},`;

  switch (category) {
    case ComplianceCategory.GSTR_1:
      if (slot === 0) {
        return {
          title: `GST sales bills due — ${month}`,
          body: `${greeting} a gentle reminder that your ${month} sales bills (GSTR-1) are due for submission by ${dueDate}. Please upload them at your convenience.`,
        };
      }
      if (slot === 1) {
        return {
          title: `GST sales bills still pending — ${month}`,
          body: `${greeting} your ${month} sales bills (GSTR-1) are still pending. Please upload them by ${dueDate} so we can file on time.`,
        };
      }
      return {
        title: `Last day to submit GSTR-1 — ${month}`,
        body: `${greeting} TODAY is the last day to submit your ${month} sales bills (GSTR-1). Please upload immediately to avoid a late filing.`,
      };

    case ComplianceCategory.GSTR_3B:
      if (quarter) {
        return {
          title: `GSTR-3B purchase bills due — ${quarter}`,
          body: `${greeting} a reminder that your ${quarter} purchase bills (GSTR-3B) are due by ${dueDate}. Please upload the purchase documents for the quarter.`,
        };
      }
      return {
        title: `GST purchase bills due — ${month}`,
        body: `${greeting} a reminder that your ${month} purchase bills (GSTR-3B) are due by ${dueDate}. Please upload the purchase documents so we can file your return on time.`,
      };

    case ComplianceCategory.IFF:
      if (slot === 0) {
        return {
          title: `IFF sales summary due — ${month}`,
          body: `${greeting} a gentle reminder that your ${month} IFF sales summary is due by ${dueDate}. Please upload it at your convenience.`,
        };
      }
      if (slot === 1) {
        return {
          title: `IFF still pending — ${month}`,
          body: `${greeting} your ${month} IFF sales summary is still pending. Please upload it by ${dueDate}.`,
        };
      }
      return {
        title: `IFF due very soon — ${month}`,
        body: `${greeting} your ${month} IFF sales summary is due very soon. If your sales were nil, please tap 'File Nil' so we can proceed.`,
      };

    default:
      // Never scheduled automatically: GST_PAYMENT / legacy values. Manual only.
      return {
        title: `Documents due for GST filing — ${month}`,
        body: `${greeting} your ${month} documents are due by ${dueDate}. Please upload them in the app.`,
      };
  }
}

/**
 * Labels and colours for due date categories. Keys match the backend
 * (`DUE_DATE_CATEGORIES`). Class strings are literal so Tailwind picks them up.
 * Keep in sync with admin/src/app/core/due-date-meta.ts.
 */
export const DUE_DATE_CATEGORIES: Record<string, { label: string; dot: string; chip: string; icon: string }> = {
  gst: {
    label: 'GST',
    dot: 'bg-blue-500',
    chip: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    icon: 'receipt_long',
  },
  income_tax: {
    label: 'Income Tax',
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    icon: 'account_balance_wallet',
  },
  tds: {
    label: 'TDS / TCS',
    dot: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    icon: 'percent',
  },
};

export const DUE_DATE_CATEGORY_KEYS = Object.keys(DUE_DATE_CATEGORIES);

/**
 * Audiences (see backend DUE_DATE_AUDIENCES) that apply to a client, from
 * their profile. `null` means the profile doesn't say — show everything.
 */
export function relevantAudiences(
  userType: string | undefined,
  gstFrequency: string | undefined,
): Set<string> | null {
  const gst = userType === 'gst' || userType === 'both';
  const itr = userType === 'itr' || userType === 'both';
  if (!gst && !itr) return null;
  const out = new Set(['all']);
  if (gst) {
    out.add('gst_all');
    if (gstFrequency !== 'quarterly') out.add('gst_monthly');
    if (gstFrequency !== 'monthly') out.add('gst_quarterly');
    // GST clients run a business: TDS and business / audit ITR dates apply
    out.add('tds');
    out.add('itr_business');
    out.add('itr_audit');
  }
  if (itr) out.add('itr_individual');
  return out;
}

/** Indian financial year of a date: "2026-27" for 1 Apr 2026 to 31 Mar 2027. */
export function fyOf(d: Date): string {
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Whole days from `today` to `due` (both YYYY-MM-DD); 0 when due today. */
export function daysUntil(due: string, today: string): number {
  return Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** Earliest deadline on or after `today` that applies to the client (null audiences = all). */
export function nextDue<T extends { due_date: string; audiences: string[] }>(
  rows: T[],
  today: string,
  audiences: Set<string> | null,
): T | null {
  let best: T | null = null;
  for (const r of rows) {
    if (r.due_date < today) continue;
    if (audiences && !r.audiences.some((a) => audiences.has(a))) continue;
    if (!best || r.due_date < best.due_date) best = r;
  }
  return best;
}

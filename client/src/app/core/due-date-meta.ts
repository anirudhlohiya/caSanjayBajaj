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

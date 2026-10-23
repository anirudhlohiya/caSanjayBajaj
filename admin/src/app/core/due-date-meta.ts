/**
 * Labels and colours for due date categories / audiences. Keys match the
 * backend (`DUE_DATE_CATEGORIES`, `DUE_DATE_AUDIENCES`). Class strings are
 * literal so Tailwind picks them up.
 * Keep in sync with client/src/app/core/due-date-meta.ts.
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

/** Who a deadline applies to — drives the client's "relevant to me" view. */
export const DUE_DATE_AUDIENCES: Array<{ key: string; label: string; hint: string }> = [
  { key: 'all', label: 'Everyone', hint: 'Shown to every client' },
  { key: 'gst_all', label: 'All GST clients', hint: 'Monthly and quarterly' },
  { key: 'gst_monthly', label: 'GST — monthly filers', hint: '' },
  { key: 'gst_quarterly', label: 'GST — quarterly (QRMP)', hint: '' },
  { key: 'gst_composition', label: 'GST — composition', hint: 'Only in the "All" view' },
  { key: 'tds', label: 'TDS / TCS deductors', hint: 'Shown to GST (business) clients' },
  { key: 'itr_individual', label: 'ITR — individuals', hint: 'ITR clients' },
  { key: 'itr_business', label: 'ITR — business, non-audit', hint: 'GST (business) clients' },
  { key: 'itr_audit', label: 'ITR — audit cases', hint: 'GST (business) clients' },
];

export const AUDIENCE_LABELS: Record<string, string> = Object.fromEntries(
  DUE_DATE_AUDIENCES.map((a) => [a.key, a.label]),
);

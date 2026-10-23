/**
 * Icon-tile colours for services. Keys match `SERVICE_ICON_COLORS` in the
 * backend DTO; the class strings are literal so Tailwind picks them up.
 * Keep in sync with client/src/app/core/service-palette.ts.
 */
export const SERVICE_COLORS: Record<string, { tile: string; swatch: string }> = {
  blue: { tile: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300', swatch: 'bg-blue-500' },
  green: { tile: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', swatch: 'bg-emerald-500' },
  purple: { tile: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', swatch: 'bg-violet-500' },
  orange: { tile: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300', swatch: 'bg-orange-500' },
  red: { tile: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', swatch: 'bg-rose-500' },
  teal: { tile: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300', swatch: 'bg-teal-500' },
  indigo: { tile: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300', swatch: 'bg-indigo-500' },
  slate: { tile: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300', swatch: 'bg-slate-500' },
  amber: { tile: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', swatch: 'bg-amber-500' },
  pink: { tile: 'bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300', swatch: 'bg-pink-500' },
};

export const SERVICE_COLOR_KEYS = Object.keys(SERVICE_COLORS);

export function serviceTileClass(color: string | null | undefined): string {
  return (SERVICE_COLORS[color ?? ''] ?? SERVICE_COLORS['slate']).tile;
}

/** Curated Material Symbols that suit a CA firm's services. */
export const SERVICE_ICONS: string[] = [
  'receipt_long', 'account_balance_wallet', 'account_balance', 'trending_up', 'real_estate_agent',
  'health_and_safety', 'pie_chart', 'business', 'fact_check', 'calculate', 'gavel', 'description',
  'request_quote', 'savings', 'payments', 'currency_rupee', 'credit_card', 'shield', 'verified_user',
  'apartment', 'store', 'factory', 'handshake', 'groups', 'person', 'family_restroom', 'school',
  'home', 'directions_car', 'local_hospital', 'policy', 'assignment', 'task_alt', 'checklist',
  'inventory_2', 'analytics', 'bar_chart', 'monitoring', 'query_stats', 'insights', 'workspace_premium',
  'badge', 'contract', 'edit_document', 'folder_shared', 'cloud_upload', 'support_agent', 'lightbulb',
  'public', 'flight', 'diamond', 'volunteer_activism', 'elderly', 'work', 'domain', 'storefront',
];

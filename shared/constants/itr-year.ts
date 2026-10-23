/**
 * ITR year helpers shared by the admin and client apps.
 *
 * Returns are stored by assessment year (AY, "2026-27"), but shown to people
 * by the financial year the income belongs to: AY 2026-27 → "ITR 25-26".
 * The year being filed now is the previous financial year, so it rolls over
 * on 1 April (Oct 2026 → AY 2026-27 → "ITR 25-26").
 */

/** AY whose return is being filed now, e.g. "2026-27" during FY 2026-27. */
export function currentAssessmentYear(today: Date = new Date()): string {
  const start = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** The current AY and the ones before it, newest first. */
export function recentAssessmentYears(count = 4, today: Date = new Date()): string[] {
  const start = Number(currentAssessmentYear(today).slice(0, 4));
  return Array.from({ length: count }, (_, i) => {
    const y = start - i;
    return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  });
}

/** "2026-27" → "ITR 25-26". */
export function itrYearLabel(assessmentYear: string): string {
  const start = Number(assessmentYear.slice(0, 4)) - 1;
  if (!Number.isFinite(start)) return assessmentYear;
  return `ITR ${String(start % 100).padStart(2, '0')}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export const FAMILY_RELATIONS: Array<{ key: string; label: string }> = [
  { key: 'spouse', label: 'Spouse' },
  { key: 'son', label: 'Son' },
  { key: 'daughter', label: 'Daughter' },
  { key: 'father', label: 'Father' },
  { key: 'mother', label: 'Mother' },
  { key: 'brother', label: 'Brother' },
  { key: 'sister', label: 'Sister' },
  { key: 'other', label: 'Other' },
];

/** Account holder + this many family members (matches the backend). */
export const MAX_FAMILY_MEMBERS = 5;

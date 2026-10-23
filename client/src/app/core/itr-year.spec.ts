import {
  currentAssessmentYear,
  itrYearLabel,
  recentAssessmentYears,
} from '../../../../shared/constants/itr-year';

describe('ITR year helpers', () => {
  it('files the previous financial year, rolling over on 1 April', () => {
    // FY 2026-27 is running → the return being filed is ITR 25-26 (AY 2026-27)
    expect(currentAssessmentYear(new Date(2026, 9, 24))).toBe('2026-27');
    expect(currentAssessmentYear(new Date(2027, 2, 31))).toBe('2026-27');
    expect(currentAssessmentYear(new Date(2027, 3, 1))).toBe('2027-28');
  });

  it('labels an assessment year by its financial year', () => {
    expect(itrYearLabel('2026-27')).toBe('ITR 25-26');
    expect(itrYearLabel('2000-01')).toBe('ITR 99-00');
  });

  it('lists the current year and the three before it', () => {
    expect(recentAssessmentYears(4, new Date(2026, 9, 24))).toEqual([
      '2026-27',
      '2025-26',
      '2024-25',
      '2023-24',
    ]);
  });
});

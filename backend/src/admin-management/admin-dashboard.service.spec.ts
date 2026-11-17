import { lastSixMonths } from './admin-dashboard.service';

describe('lastSixMonths', () => {
  it('returns six months oldest first, filling gaps with 0 across a year change', () => {
    const out = lastSixMonths(
      [
        { month: '2026-02', count: 4 },
        { month: '2025-10', count: 1 },
      ],
      new Date(2026, 1, 15),
    );
    expect(out).toEqual([
      { month: '2025-09', count: 0 },
      { month: '2025-10', count: 1 },
      { month: '2025-11', count: 0 },
      { month: '2025-12', count: 0 },
      { month: '2026-01', count: 0 },
      { month: '2026-02', count: 4 },
    ]);
  });
});

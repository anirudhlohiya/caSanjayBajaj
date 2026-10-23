/**
 * Statutory due dates for FY 2026-27 (due between 1 Apr 2026 and 31 Mar 2027),
 * seeded once by migration 1800000000005. Staff own the data afterwards in the
 * admin panel (edits, extensions, additions) — nothing here is re-applied.
 *
 * Sources checked Oct 2026: CBIC / GSTN return calendars, CBDT Circular 07/2026
 * (tax audit 30 Sep → 21 Oct 2026, audit-case ITR 31 Oct → 21 Nov 2026), and
 * the Income-tax Act, 2025 TDS form mapping from 1 Apr 2026 (24Q → 138,
 * 26Q → 140, 27Q → 144, 27EQ → 143, 16A → 131).
 */

export type DueDateCategory = 'gst' | 'income_tax' | 'tds';

/**
 * Who a due date applies to. The client app uses these to pick the
 * "relevant to me" view from the client's profile.
 */
export const DUE_DATE_AUDIENCES = [
  'all',
  'gst_all',
  'gst_monthly',
  'gst_quarterly',
  'gst_composition',
  'tds',
  'itr_individual',
  'itr_business',
  'itr_audit',
] as const;
export type DueDateAudience = (typeof DUE_DATE_AUDIENCES)[number];

export interface DefaultDueDate {
  title: string;
  form: string | null;
  category: DueDateCategory;
  due_date: string;
  original_due_date?: string;
  period_label: string | null;
  description: string;
  audiences: DueDateAudience[];
}

export const DUE_DATES_FY = '2026-27';

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

/** YYYY-MM-DD for a 0-based month index counted from Jan 2026. */
function ymd(monthIndex: number, day: number): string {
  const year = 2026 + Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function label(monthIndex: number): string {
  return `${MONTHS[monthIndex % 12]} ${2026 + Math.floor(monthIndex / 12)}`;
}

const MAR_2026 = 2;
const FEB_2027 = 13;

function monthly(): DefaultDueDate[] {
  const rows: DefaultDueDate[] = [];
  // Return periods Mar 2026 … Feb 2027 → due dates Apr 2026 … Mar 2027
  for (let m = MAR_2026; m <= FEB_2027; m++) {
    const period = label(m);
    const next = m + 1;
    rows.push(
      {
        title: 'GSTR-1 (monthly)',
        form: 'GSTR-1',
        category: 'gst',
        due_date: ymd(next, 11),
        period_label: period,
        description: 'Details of outward supplies (sales) for monthly filers.',
        audiences: ['gst_monthly'],
      },
      {
        title: 'GSTR-3B (monthly)',
        form: 'GSTR-3B',
        category: 'gst',
        due_date: ymd(next, 20),
        period_label: period,
        description:
          'Summary return and payment of GST for monthly filers. Late filing attracts late fee and 18% interest.',
        audiences: ['gst_monthly'],
      },
    );
    // TDS/TCS deposit: 7th of next month, except March which is 30 April
    if (m !== MAR_2026) {
      rows.push({
        title: 'TDS / TCS deposit',
        form: 'Challan',
        category: 'tds',
        due_date: ymd(next, 7),
        period_label: period,
        description: `Deposit TDS / TCS deducted or collected in ${period}.`,
        audiences: ['tds'],
      });
    }
    // QRMP: first two months of each quarter (Apr, May, Jul, Aug, Oct, Nov, Jan, Feb)
    const monthOfQuarter = (m % 12) % 3; // Jan/Apr/Jul/Oct = 0
    if (m > MAR_2026 && monthOfQuarter !== 2) {
      rows.push(
        {
          title: 'IFF (optional, QRMP)',
          form: 'IFF',
          category: 'gst',
          due_date: ymd(next, 13),
          period_label: period,
          description:
            'Invoice Furnishing Facility — optional upload of B2B invoices so your buyers get input tax credit monthly.',
          audiences: ['gst_quarterly'],
        },
        {
          title: 'GST payment (QRMP)',
          form: 'PMT-06',
          category: 'gst',
          due_date: ymd(next, 25),
          period_label: period,
          description:
            'Monthly GST payment for quarterly filers (fixed-sum or self-assessment method).',
          audiences: ['gst_quarterly'],
        },
      );
    }
  }
  return rows;
}

/** Quarters ending Mar 2026, Jun 2026, Sep 2026, Dec 2026 → due the month after. */
const QUARTERS = [
  { label: 'Q4 FY 2025-26 (Jan–Mar 2026)', after: 3 },
  { label: 'Q1 FY 2026-27 (Apr–Jun 2026)', after: 6 },
  { label: 'Q2 FY 2026-27 (Jul–Sep 2026)', after: 9 },
  { label: 'Q3 FY 2026-27 (Oct–Dec 2026)', after: 12 },
];

function quarterly(): DefaultDueDate[] {
  const rows: DefaultDueDate[] = [];
  for (const q of QUARTERS) {
    rows.push(
      {
        title: 'GSTR-1 (quarterly, QRMP)',
        form: 'GSTR-1',
        category: 'gst',
        due_date: ymd(q.after, 13),
        period_label: q.label,
        description: 'Quarterly statement of outward supplies under QRMP.',
        audiences: ['gst_quarterly'],
      },
      {
        title: 'GSTR-3B (quarterly) — Category X states',
        form: 'GSTR-3B',
        category: 'gst',
        due_date: ymd(q.after, 22),
        period_label: q.label,
        description:
          'For QRMP taxpayers in Chhattisgarh, MP, Gujarat, Maharashtra, Karnataka, Goa, Kerala, Tamil Nadu, Telangana, Andhra Pradesh, Daman & Diu, Dadra & Nagar Haveli, Puducherry, Andaman & Nicobar and Lakshadweep.',
        audiences: ['gst_quarterly'],
      },
      {
        title: 'GSTR-3B (quarterly) — Category Y states',
        form: 'GSTR-3B',
        category: 'gst',
        due_date: ymd(q.after, 24),
        period_label: q.label,
        description:
          'For QRMP taxpayers in all other states and UTs, including Delhi, Rajasthan, Uttar Pradesh, Punjab, Haryana, West Bengal, Bihar and the North-East.',
        audiences: ['gst_quarterly'],
      },
      {
        title: 'Composition statement',
        form: 'CMP-08',
        category: 'gst',
        due_date: ymd(q.after, 18),
        period_label: q.label,
        description:
          'Quarterly self-assessed tax statement for composition dealers.',
        audiences: ['gst_composition'],
      },
    );
  }

  // TDS / TCS quarterly statements. Q4 FY 2025-26 is still on the 1961 Act forms.
  rows.push(
    {
      title: 'TCS return Q4 FY 2025-26',
      form: '27EQ',
      category: 'tds',
      due_date: '2026-05-15',
      period_label: QUARTERS[0].label,
      description:
        'Quarterly TCS statement (last quarter under the Income-tax Act, 1961).',
      audiences: ['tds'],
    },
    {
      title: 'TDS returns Q4 FY 2025-26',
      form: '24Q / 26Q / 27Q',
      category: 'tds',
      due_date: '2026-05-31',
      period_label: QUARTERS[0].label,
      description:
        'Quarterly TDS statements for salary, residents and non-residents.',
      audiences: ['tds'],
    },
    {
      title: 'Form 16A (Q4 FY 2025-26)',
      form: '16A',
      category: 'tds',
      due_date: '2026-06-15',
      period_label: QUARTERS[0].label,
      description: 'Issue non-salary TDS certificates to deductees.',
      audiences: ['tds'],
    },
  );
  const newActReturns: Array<{ q: number; due: string; cert: string }> = [
    { q: 1, due: '2026-07-31', cert: '2026-08-15' },
    { q: 2, due: '2026-10-31', cert: '2026-11-15' },
    { q: 3, due: '2027-01-31', cert: '2027-02-15' },
  ];
  for (const r of newActReturns) {
    rows.push(
      {
        title: `TDS / TCS returns Q${r.q}`,
        form: '138 / 140 / 144 / 143',
        category: 'tds',
        due_date: r.due,
        period_label: QUARTERS[r.q].label,
        description:
          'Quarterly statements under the Income-tax Act, 2025: Form 138 (salary, earlier 24Q), 140 (residents, earlier 26Q), 144 (non-residents, earlier 27Q), 143 (TCS, earlier 27EQ).',
        audiences: ['tds'],
      },
      {
        title: `TDS certificate Q${r.q}`,
        form: '131',
        category: 'tds',
        due_date: r.cert,
        period_label: QUARTERS[r.q].label,
        description:
          'Issue non-salary TDS certificates (Form 131, earlier 16A) — 15 days after the return due date.',
        audiences: ['tds'],
      },
    );
  }
  return rows;
}

function annual(): DefaultDueDate[] {
  return [
    // TDS
    {
      title: 'TDS deposit for March 2026',
      form: 'Challan',
      category: 'tds',
      due_date: '2026-04-30',
      period_label: 'March 2026',
      description:
        'TDS deducted in March is due by 30 April (7 April for government deductors).',
      audiences: ['tds'],
    },
    {
      title: 'Form 16 to employees',
      form: '16',
      category: 'tds',
      due_date: '2026-06-15',
      period_label: 'FY 2025-26',
      description:
        'Issue salary TDS certificates (Form 16) for FY 2025-26 to employees.',
      audiences: ['tds'],
    },
    // Advance tax
    ...[
      { date: '2026-06-15', pct: '15%', n: '1st' },
      { date: '2026-09-15', pct: '45%', n: '2nd' },
      { date: '2026-12-15', pct: '75%', n: '3rd' },
    ].map((a): DefaultDueDate => ({
      title: `Advance tax — ${a.n} instalment`,
      form: null,
      category: 'income_tax',
      due_date: a.date,
      period_label: 'FY 2026-27',
      description: `Pay at least ${a.pct} of the estimated tax for the year (if total tax exceeds ₹10,000).`,
      audiences: ['all'],
    })),
    {
      title: 'Advance tax — final instalment',
      form: null,
      category: 'income_tax',
      due_date: '2027-03-15',
      period_label: 'FY 2026-27',
      description:
        'Pay 100% of the estimated tax for the year. Presumptive-scheme taxpayers (44AD / 44ADA) pay the full amount by this date.',
      audiences: ['all'],
    },
    // ITR — AY 2026-27 (FY 2025-26)
    {
      title: 'ITR filing — individuals (no business income)',
      form: 'ITR-1 / ITR-2',
      category: 'income_tax',
      due_date: '2026-07-31',
      period_label: 'AY 2026-27',
      description:
        'Income tax return for salaried and other individuals / HUFs without business income and without audit.',
      audiences: ['itr_individual'],
    },
    {
      title: 'ITR filing — business / profession (non-audit)',
      form: 'ITR-3 / ITR-4',
      category: 'income_tax',
      due_date: '2026-08-31',
      period_label: 'AY 2026-27',
      description:
        'Return for business and professional income where no tax audit is required.',
      audiences: ['itr_business'],
    },
    {
      title: 'Tax audit report',
      form: '3CA / 3CB-3CD',
      category: 'income_tax',
      due_date: '2026-10-21',
      original_due_date: '2026-09-30',
      period_label: 'AY 2026-27',
      description: 'Extended by CBDT Circular 07/2026.',
      audiences: ['itr_audit'],
    },
    {
      title: 'Transfer pricing report',
      form: '3CEB',
      category: 'income_tax',
      due_date: '2026-10-31',
      period_label: 'AY 2026-27',
      description:
        'Accountant’s report for international / specified domestic transactions (Sec. 92E).',
      audiences: ['itr_audit'],
    },
    {
      title: 'ITR filing — audit cases',
      form: 'ITR-3 / 5 / 6',
      category: 'income_tax',
      due_date: '2026-11-21',
      original_due_date: '2026-10-31',
      period_label: 'AY 2026-27',
      description:
        'Companies and assessees whose accounts are audited. Extended by CBDT Circular 07/2026.',
      audiences: ['itr_audit'],
    },
    {
      title: 'ITR filing — transfer pricing cases',
      form: 'ITR-3 / 5 / 6',
      category: 'income_tax',
      due_date: '2026-11-30',
      period_label: 'AY 2026-27',
      description: 'Assessees required to furnish a Form 3CEB report.',
      audiences: ['itr_audit'],
    },
    {
      title: 'Belated ITR',
      form: 'ITR',
      category: 'income_tax',
      due_date: '2026-12-31',
      period_label: 'AY 2026-27',
      description:
        'Last date to file a belated return (late fee applies) for FY 2025-26.',
      audiences: ['all'],
    },
    // GST annual
    {
      title: 'GSTR-4 annual return',
      form: 'GSTR-4',
      category: 'gst',
      due_date: '2026-06-30',
      period_label: 'FY 2025-26',
      description: 'Annual return for composition taxpayers.',
      audiences: ['gst_composition'],
    },
    {
      title: 'GST annual return',
      form: 'GSTR-9 / 9C',
      category: 'gst',
      due_date: '2026-12-31',
      period_label: 'FY 2025-26',
      description:
        'Annual return (GSTR-9) and, where turnover exceeds ₹5 crore, the reconciliation statement (GSTR-9C).',
      audiences: ['gst_all'],
    },
  ];
}

export const DEFAULT_DUE_DATES: DefaultDueDate[] = [
  ...monthly(),
  ...quarterly(),
  ...annual(),
].sort((a, b) => a.due_date.localeCompare(b.due_date));

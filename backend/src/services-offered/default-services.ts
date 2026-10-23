/**
 * The firm's standard service catalogue. Seeded once by migration
 * 1800000000004; after that, staff own the content in the admin panel and
 * nothing here is re-applied.
 */
export interface DefaultService {
  slug: string;
  title: string;
  description: string;
  icon: string;
  icon_color: string;
  tags: string[];
  body_md: string;
}

export const DEFAULT_SERVICES: DefaultService[] = [
  {
    slug: 'gst',
    title: 'GST Services',
    icon: 'receipt_long',
    icon_color: 'blue',
    description:
      'Comprehensive GST solutions including Registration, Return Filing, and Refund processing to ensure seamless compliance.',
    tags: ['Registration', 'Return Filing', 'Refund'],
    body_md: `## What we do

We handle your GST compliance end to end, so you can focus on running your business.

### GST Registration
- New registration for proprietorships, partnerships, LLPs and companies
- Amendments (address, partners, business details) and cancellation
- Composition scheme opt-in / opt-out

### Return Filing
- **GSTR-1 / IFF** – outward supplies, monthly or quarterly (QRMP)
- **GSTR-3B** – summary return and tax payment
- **GSTR-9 / 9C** – annual return and reconciliation statement
- Input tax credit reconciliation with GSTR-2B every month

### Refunds & Notices
- Export / LUT refunds and inverted duty structure refunds
- Replies to GST notices and support during departmental audits

## Documents we need every month
1. Sales invoices (or sales register)
2. Purchase invoices
3. Debit / credit notes
4. Bank statement (if asked)

Upload them in the **Documents** tab of this app before the due date — we'll take it from there.

## Due dates at a glance
| Return | Due date |
|---|---|
| GSTR-1 (monthly) | 11th of next month |
| IFF (QRMP) | 13th of next month |
| GSTR-3B (monthly) | 20th of next month |

> Late filing attracts a late fee and interest, so please share your data on time.
`,
  },
  {
    slug: 'income-tax',
    title: 'Income Tax',
    icon: 'account_balance_wallet',
    icon_color: 'green',
    description:
      'Expert ITR Filing, Strategic Tax Planning, and meticulous TDS management optimized for individuals and corporate entities.',
    tags: ['ITR Filing', 'Tax Planning', 'TDS'],
    body_md: `## What we do

### ITR Filing
- Returns for salaried individuals, professionals, businesses, firms and companies (ITR-1 to ITR-7)
- Capital gains on shares, mutual funds and property
- Revised and belated returns

### Tax Planning
- Choosing between the old and new tax regime
- Deductions under 80C, 80D, HRA, home loan interest and more
- Advance tax computation so you never pay interest

### TDS
- TDS / TCS return filing (24Q, 26Q, 27Q)
- Form 16 / 16A generation
- Correction of TDS mismatches in Form 26AS / AIS

### Notices
- Replies to income tax notices and scrutiny assessments

## Documents we need
1. PAN and Aadhaar
2. Form 16 (salaried) or books of accounts (business)
3. Bank statements and interest certificates
4. Investment proofs (LIC, PPF, ELSS, health insurance)
5. Capital gains statements from your broker / AMC

## Key dates
- **31 July** – ITR due date for individuals (non-audit)
- **15 Jun / Sep / Dec / Mar** – advance tax instalments
`,
  },
  {
    slug: 'mutual-funds',
    title: 'Mutual Funds',
    icon: 'trending_up',
    icon_color: 'purple',
    description:
      'Tailored investment strategies through SIPs and Lump Sum allocations aligned with your specific long-term goals.',
    tags: ['SIP', 'Lump Sum', 'Goal Planning'],
    body_md: `## Invest with a plan

We help you choose mutual funds that match your goals, time horizon and risk appetite.

### SIP (Systematic Investment Plan)
- Start with small monthly amounts
- Rupee-cost averaging across market cycles
- Step-up SIPs that grow with your income

### Lump Sum
- Deploying bonuses or savings in one go
- STP (systematic transfer) for volatile markets

### Goal Planning
- Child education, marriage, house purchase, retirement
- Periodic review and rebalancing of your portfolio

## How it works
1. A short call to understand your goals
2. Risk profiling and a recommended portfolio
3. KYC and investment setup
4. Regular reviews

> Mutual fund investments are subject to market risks. Read all scheme-related documents carefully.
`,
  },
  {
    slug: 'loans',
    title: 'Loan Services',
    icon: 'real_estate_agent',
    icon_color: 'orange',
    description:
      'Streamlined processing and advisory for Home, Personal, and Business Loans to secure optimal financing terms.',
    tags: ['Home', 'Personal', 'Business'],
    body_md: `## Get the right loan, faster

We prepare your financials and paperwork so banks see a strong, complete application.

### Home Loans
- New purchase, construction, balance transfer and top-up

### Personal Loans
- Quick comparison of offers across lenders

### Business Loans
- Working capital, term loans, CC / OD limits
- Project reports and CMA data for banks
- MSME and government-scheme loans

## Documents usually needed
1. KYC – PAN, Aadhaar, address proof
2. Last 2–3 years' ITRs and financial statements
3. 6–12 months of bank statements
4. Property papers (for secured loans)
`,
  },
  {
    slug: 'insurance',
    title: 'Insurance',
    icon: 'health_and_safety',
    icon_color: 'red',
    description:
      'Risk mitigation through structured Life, Health, and General Insurance policies tailored to protect your assets.',
    tags: ['Life', 'Health', 'General'],
    body_md: `## Protect what matters

### Life Insurance
- Term plans with adequate cover for your family
- Review of existing policies

### Health Insurance
- Individual and family floater plans
- Top-up / super top-up covers
- Tax benefit under Section 80D

### General Insurance
- Motor, shop / office, fire and stock insurance
- Business liability covers

## Our approach
1. Understand your needs and existing cover
2. Compare plans across insurers
3. Help with the proposal and, later, with claims
`,
  },
  {
    slug: 'financial-planning',
    title: 'Financial Planning',
    icon: 'pie_chart',
    icon_color: 'teal',
    description:
      'Holistic approaches to Wealth Creation and Retirement Planning ensuring sustained financial stability and growth.',
    tags: ['Wealth Creation', 'Retirement'],
    body_md: `## A plan for every stage of life

### Wealth Creation
- Budgeting and savings targets
- Asset allocation across equity, debt and gold
- Tax-efficient investing

### Retirement Planning
- How much you need to retire comfortably
- NPS, PPF, mutual funds and annuities
- Withdrawal strategy after retirement

## What you get
- A written financial plan
- Clear monthly action points
- Yearly review meetings
`,
  },
  {
    slug: 'company-incorporation',
    title: 'Company Incorporation',
    icon: 'business',
    icon_color: 'indigo',
    description:
      'End-to-end assistance with entity formation, ROC Filing, and ongoing regulatory compliance frameworks.',
    tags: ['ROC Filing', 'Compliance'],
    body_md: `## Start and run your business the right way

### Incorporation
- Private Limited Company, LLP, OPC and partnership firms
- Name approval, DSC and DIN
- MOA / AOA drafting, PAN and TAN

### ROC Filing
- Annual returns (AOC-4, MGT-7 / 7A, Form 11 & 8 for LLPs)
- Director KYC and event-based filings (change of directors, share allotment)

### Ongoing Compliance
- Statutory registers and board / general meeting minutes
- Registrations: MSME (Udyam), Shops & Establishment, Import Export Code

## Documents needed for incorporation
1. PAN, Aadhaar and photos of directors / partners
2. Registered office proof and NOC from the owner
3. Proposed names and business activity
`,
  },
  {
    slug: 'audit',
    title: 'Audit & Assurance',
    icon: 'fact_check',
    icon_color: 'slate',
    description:
      'Rigorous Internal and Statutory Audits designed to enhance operational transparency and financial fidelity.',
    tags: ['Internal Audit', 'Statutory Audit'],
    body_md: `## Independent, reliable assurance

### Statutory Audit
- Company audits under the Companies Act, 2013
- Tax audit under Section 44AB of the Income Tax Act

### Internal Audit
- Review of internal controls and processes
- Stock, receivables and cash verification
- Practical recommendations to reduce leakages

### Other Assurance
- Certifications for banks and government departments
- Due diligence

## Our process
1. Planning meeting and document checklist
2. Fieldwork and testing
3. Draft observations discussed with management
4. Final report
`,
  },
];

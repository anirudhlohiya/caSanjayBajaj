export const INDUSTRIES = [
  'Textiles',
  'Manufacturing',
  'Retail',
  'Wholesale / Trading',
  'Food & Beverage',
  'Hospitality',
  'Real Estate',
  'Construction',
  'IT / Software',
  'Professional Services',
  'Healthcare',
  'Education',
  'Transport / Logistics',
  'Agriculture',
  'Others',
] as const;

export type Industry = (typeof INDUSTRIES)[number];

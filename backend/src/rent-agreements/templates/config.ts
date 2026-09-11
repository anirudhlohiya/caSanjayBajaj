export interface TemplateField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'currency' | 'multiline' | 'array';
  required: boolean;
  section: string;
  options?: { label: string; value: string }[];
  arrayFields?: Omit<TemplateField, 'section' | 'arrayFields'>[];
}

export interface TemplateConfig {
  id: string;
  name: string;
  language: string;
  category: string;
  description: string;
  templateFileName: string;
  fields: TemplateField[];
}

export const TEMPLATES: TemplateConfig[] = [
  {
    id: 'unified-rent-agreement',
    name: 'Unified Rent Agreement',
    language: 'English',
    category: 'Residential & Commercial',
    description: 'Dynamic agreement template supporting multiple licensors, licensees, and auto-calculations.',
    templateFileName: 'TOWER-1-804-fixed.docx',
    fields: [
      { key: 'PROPERTY_ADDRESS', label: 'Property Address', type: 'multiline', required: true, section: 'Property Details' },
      { key: 'starting date', label: 'Agreement Start Date', type: 'date', required: true, section: 'Agreement Details' },
      { key: 'ending date', label: 'Agreement End Date', type: 'date', required: true, section: 'Agreement Details' },
      { key: 'rent in numbers', label: 'Monthly Rent', type: 'currency', required: true, section: 'Payment Details' },
      { key: 'deposit in numbers', label: 'Deposit Amount', type: 'currency', required: true, section: 'Payment Details' },
      {
        key: 'property_tax_payer',
        label: 'Property Tax Paid By',
        type: 'select',
        required: true,
        section: 'Agreement Details',
        options: [
          { label: 'Included in the RENT', value: 'included in the RENT' },
          { label: 'Tenant', value: 'Tenant' },
          { label: 'Landlord', value: 'Landlord' },
        ],
      },
      {
        key: 'maintenance_payer',
        label: 'Maintenance Charges Paid By',
        type: 'select',
        required: true,
        section: 'Agreement Details',
        options: [
          { label: 'Tenant', value: 'Tenant' },
          { label: 'Landlord', value: 'Landlord' },
        ],
      },
      {
        key: 'licensors',
        label: 'Licensors',
        type: 'array',
        required: true,
        section: 'Owner Details',
        arrayFields: [
          { key: 'name', label: 'Full Name', type: 'text', required: true },
          { key: 'gender', label: 'Gender', type: 'select', required: true, options: [{label: 'Male', value: 'Male'}, {label: 'Female', value: 'Female'}] },
          { key: 'dob', label: 'Date of Birth', type: 'date', required: true },
          { key: 'occupation', label: 'Occupation', type: 'text', required: true },
        ],
      },
      {
        key: 'licensees',
        label: 'Licensees',
        type: 'array',
        required: true,
        section: 'Tenant Details',
        arrayFields: [
          { key: 'name', label: 'Full Name', type: 'text', required: true },
          { key: 'gender', label: 'Gender', type: 'select', required: true, options: [{label: 'Male', value: 'Male'}, {label: 'Female', value: 'Female'}] },
          { key: 'dob', label: 'Date of Birth', type: 'date', required: true },
          { key: 'occupation', label: 'Occupation', type: 'text', required: true },
        ],
      },
    ],
  },
];

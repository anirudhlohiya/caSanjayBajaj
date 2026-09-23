/**
 * Meta-approved WhatsApp Utility templates used by the platform.
 *
 * The body text here must match what was submitted to Meta exactly — it is
 * used to render the stored copy of each sent template (admin desk thread)
 * and to show a preview in the admin "New message" composer. Names are
 * overridable via env (see configuration.ts → whatsapp.templates).
 */
export interface WhatsappTemplateDef {
  key: WhatsappTemplateKey;
  name: string;
  language: string;
  body: string;
  /** Human labels for {{1}}..{{n}}, used by the admin composer. */
  params: string[];
  /** Example values submitted to Meta for review. */
  examples: string[];
}

export type WhatsappTemplateKey =
  'returnFiled' | 'paymentReminder' | 'documentsReminder' | 'generalFollowup';

export const WHATSAPP_TEMPLATE_DEFAULTS: Record<
  WhatsappTemplateKey,
  Omit<WhatsappTemplateDef, 'key'>
> = {
  returnFiled: {
    name: 'gst_return_filed',
    language: 'en',
    body: 'Hi {{1}}, your {{2}} return for {{3}} has been filed successfully. ARN: {{4}}. You can view the details in the S N Bajaj And Co app.',
    params: ['Client name', 'Return type', 'Period', 'ARN'],
    examples: ['Rahul', 'GSTR-3B', 'October 2026', 'AA0810260123456'],
  },
  paymentReminder: {
    name: 'gst_payment_reminder',
    language: 'en',
    body: 'Hi {{1}}, your GST payable for {{2}} is Rs. {{3}}, due on {{4}}. Please make the payment and share the challan with us on the app or here.',
    params: ['Client name', 'Period', 'Amount', 'Due date'],
    examples: ['Rahul', 'October 2026', '14,500', '20 Nov 2026'],
  },
  documentsReminder: {
    name: 'gst_documents_reminder',
    language: 'en',
    body: 'Hi {{1}}, please upload your {{2}} documents for {{3}} by {{4}} in the S N Bajaj And Co app, or send them on this chat.',
    params: ['Client name', 'Return type', 'Period', 'Due date'],
    examples: ['Rahul', 'GSTR-1', 'October 2026', '11 Nov 2026'],
  },
  // Staff-initiated chats. Replaces gst_general_followup, which Meta
  // re-categorised as MARKETING for being too open-ended (Oct 2026).
  generalFollowup: {
    name: 'gst_filing_input_required',
    language: 'en',
    body: 'Hi {{1}}, we need a quick input from you to complete your {{2}} for {{3}}. Please reply to this message so our team can finish it before the due date.',
    params: ['Client name', 'Filing (e.g. GSTR-3B filing)', 'Period'],
    examples: ['Rahul', 'GSTR-3B filing', 'October 2026'],
  },
};

/** Fills {{1}}..{{n}} placeholders with the given params. */
export function renderTemplateBody(body: string, params: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_m, n: string) => {
    const value = params[Number(n) - 1];
    return value !== undefined && value !== '' ? value : `{{${n}}}`;
  });
}

/** Number of distinct {{n}} placeholders in a template body. */
export function countTemplateParams(body: string): number {
  const nums = new Set(
    Array.from(body.matchAll(/\{\{(\d+)\}\}/g), (m) => Number(m[1])),
  );
  return nums.size;
}

/**
 * Starter FAQ content, seeded once by migration 1800000000007. Staff own the
 * questions afterwards in the admin panel; nothing here is re-applied.
 */
export const FAQ_CATEGORIES = [
  'gst',
  'itr',
  'documents',
  'app',
  'general',
] as const;

export interface DefaultFaq {
  category: (typeof FAQ_CATEGORIES)[number];
  question: string;
  answer_md: string;
}

export const DEFAULT_FAQS: DefaultFaq[] = [
  // GST
  {
    category: 'gst',
    question: 'Which documents do I need to share every month for GST?',
    answer_md:
      'Your **sales invoices**, **purchase invoices** and any **debit / credit notes** for the month. Upload them in the **Documents → GST** tab before the due date shown in the app.',
  },
  {
    category: 'gst',
    question: 'What happens if GSTR-3B is filed late?',
    answer_md:
      'A late fee applies for every day of delay, plus **18% interest** on any tax paid late. Sharing your documents on time lets us file before the due date.',
  },
  {
    category: 'gst',
    question: 'Should I file GST monthly or quarterly (QRMP)?',
    answer_md:
      'Businesses with turnover up to ₹5 crore can choose the quarterly **QRMP** scheme: returns every quarter, tax paid monthly. Talk to us before switching — it depends on how your buyers claim input tax credit.',
  },
  // ITR
  {
    category: 'itr',
    question: 'What is the last date to file my income tax return?',
    answer_md:
      '**31 July** for individuals without business income, **31 August** for business / professional income without audit, and later dates for audit cases. See the **Due Date Calendar** on the Home screen for the exact dates this year.',
  },
  {
    category: 'itr',
    question: 'Which documents do I need for my ITR?',
    answer_md:
      '- PAN and Aadhaar\n- Form 16 (if salaried)\n- Bank statements and interest certificates\n- Investment proofs (LIC, PPF, ELSS, health insurance)\n- Capital gains statements from your broker / mutual fund\n\nUpload them in **Documents → ITR**.',
  },
  {
    category: 'itr',
    question: 'Can I manage my family members’ ITR from my account?',
    answer_md:
      'Yes. Add up to 5 family members in **Profile → Family Members**, then pick the person on the ITR tab to upload their documents and download their returns.',
  },
  // Documents
  {
    category: 'documents',
    question: 'Which file types can I upload?',
    answer_md:
      'PDFs, photos (JPG / PNG) and Excel sheets, up to **50 MB** each. Clear photos taken on your phone are fine.',
  },
  {
    category: 'documents',
    question: 'I uploaded the wrong file. What should I do?',
    answer_md:
      'Upload the correct file and send us a note from **Profile → Support** so we can ignore the wrong one.',
  },
  {
    category: 'documents',
    question: 'Are my documents safe?',
    answer_md:
      'Yes. Files are stored encrypted in private cloud storage and are only visible to you and our team. Download links expire after a few minutes.',
  },
  // App
  {
    category: 'app',
    question: 'Why am I not getting notifications?',
    answer_md:
      'Turn on **Push notifications** in **Profile**, and allow notifications for this app in your phone / browser settings. Everything we send is also listed under the bell icon on the Home screen.',
  },
  {
    category: 'app',
    question: 'I forgot my password. How do I reset it?',
    answer_md:
      'Tap **Forgot password?** on the sign-in screen and follow the code sent to your registered email.',
  },
  // General
  {
    category: 'general',
    question: 'How can I talk to a CA?',
    answer_md:
      'Open **Talk to Expert** on the Home screen to chat on WhatsApp or call us during office hours (Monday to Saturday, 10 AM to 7 PM).',
  },
];

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-dvh bg-surface-container-lowest text-on-surface font-geist antialiased selection:bg-neutral-800 selection:text-white dark:selection:bg-neutral-200 dark:selection:text-black">
      <!-- Top Navigation Bar -->
      <header class="sticky top-0 z-30 border-b border-hairline bg-surface/80 backdrop-blur-md dark:border-hairline-strong">
        <div class="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <div class="flex items-center gap-3">
            <button
              (click)="goBack()"
              type="button"
              class="flex size-9 items-center justify-center rounded-full border border-hairline bg-surface text-on-surface transition-colors hover:bg-surface-container active:scale-95 dark:border-hairline-strong dark:bg-surface-container"
              title="Go back"
            >
              <span class="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <a routerLink="/" class="flex items-center gap-2">
              <img src="/logo-transparent.png" alt="S N Bajaj And Co" class="h-7 w-auto object-contain" onerror="this.src='/logo-login.png'" />
              <span class="font-semibold text-sm tracking-tight hidden sm:inline">S N Bajaj And Co</span>
            </a>
          </div>

          <div class="flex items-center gap-3">
            <button
              (click)="printPolicy()"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container dark:border-hairline-strong"
            >
              <span class="material-symbols-outlined text-[16px]">print</span>
              <span>Print</span>
            </button>
            <a
              [routerLink]="homeRoute"
              class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-opacity hover:opacity-90 dark:bg-white dark:text-black"
            >
              {{ homeLabel }}
            </a>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <!-- Hero Header -->
        <div class="mb-8 border-b border-hairline pb-8 dark:border-hairline-strong">
          <div class="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1 text-xs font-medium text-on-secondary-container">
            <span class="material-symbols-outlined text-[14px]">verified_user</span>
            Legal & Compliance
          </div>
          <h1 class="mt-4 font-headline text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
            Privacy Policy
          </h1>
          <p class="mt-2 text-sm text-on-surface-variant">
            Last Updated: October 2026 • Effective Date: January 1, 2025
          </p>
          <p class="mt-4 text-base leading-relaxed text-on-surface-variant">
            At <strong>S N Bajaj And Co. (Chartered Accountants)</strong>, we understand that financial documents, tax records, and business disclosures demand the highest degree of confidentiality and data protection. This Privacy Policy details how we collect, process, safeguard, and disclose your information when you use our client portal and professional compliance services.
          </p>
        </div>

        <!-- Quick Summary Box -->
        <div class="mb-10 rounded-xl border border-hairline bg-canvas-soft p-5 dark:border-hairline-strong dark:bg-surface-container">
          <h2 class="flex items-center gap-2 font-semibold text-sm text-on-surface">
            <span class="material-symbols-outlined text-secondary text-[20px]">shield</span>
            Summary of Key Commitments
          </h2>
          <ul class="mt-3 space-y-2 text-xs leading-5 text-on-surface-variant sm:text-sm">
            <li class="flex items-start gap-2">
              <span class="material-symbols-outlined text-green-600 dark:text-green-400 text-[18px]">check_circle</span>
              <span><strong>ICAI Confidentiality:</strong> All records are governed by the Code of Ethics prescribed by the Institute of Chartered Accountants of India.</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="material-symbols-outlined text-green-600 dark:text-green-400 text-[18px]">check_circle</span>
              <span><strong>Bank-Grade Storage:</strong> Documents are encrypted in transit via TLS 1.3 and at rest with AWS S3 private signed URLs.</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="material-symbols-outlined text-green-600 dark:text-green-400 text-[18px]">check_circle</span>
              <span><strong>Never Sold:</strong> We do not sell, rent, or trade your financial or personal information to any third-party advertisers.</span>
            </li>
          </ul>
        </div>

        <!-- Document Body Sections -->
        <div class="space-y-10 text-sm leading-relaxed text-on-surface-variant">
          <!-- 1. Who We Are -->
          <section>
            <h2 class="font-headline text-lg font-bold text-on-surface">1. Who We Are</h2>
            <p class="mt-2">
              S N Bajaj And Co. is a peer-reviewed Chartered Accountancy firm registered with the Institute of Chartered Accountants of India (ICAI), based in Surat, Gujarat. We provide taxation, GST compliance, accounting, financial auditing, project financing, and statutory reporting services to individuals, LLPs, partnerships, and corporations.
            </p>
          </section>

          <!-- 2. Information We Collect -->
          <section>
            <h2 class="font-headline text-lg font-bold text-on-surface">2. Information We Collect</h2>
            <p class="mt-2">
              In order to provide statutory filing, tax calculation, and portal access, we collect:
            </p>
            <ul class="mt-3 list-disc space-y-1.5 pl-5">
              <li><strong>Personal Identifiers:</strong> Name, email address, phone number, date of birth, postal address.</li>
              <li><strong>Statutory & Tax Credentials:</strong> Permanent Account Number (PAN), Goods and Services Tax Identification Number (GSTIN), Aadhaar details (where authorized for e-filing/e-verification), TAN, and MCA corporate identification numbers.</li>
              <li><strong>Financial Documents:</strong> Purchase registers, sales registers, bank statements, ledger extracts, GSTR data, TDS/TCS certificates, audit schedules, and balance sheets uploaded by you or generated by our practice.</li>
              <li><strong>Account Credentials:</strong> Hashed passwords, OTP verification timestamps, and multi-factor authentication tokens.</li>
              <li><strong>Technical Logs:</strong> IP address, browser type, device information, access logs, and timestamps for security auditing and compliance logging.</li>
            </ul>
          </section>

          <!-- 3. Legal Basis and Purpose of Processing -->
          <section>
            <h2 class="font-headline text-lg font-bold text-on-surface">3. Purpose and Legal Basis of Processing</h2>
            <p class="mt-2">We process your data strictly under the following lawful grounds:</p>
            <ul class="mt-3 list-disc space-y-1.5 pl-5">
              <li><strong>Contractual Performance:</strong> To prepare, review, and file your tax returns, balance sheets, and statutory reports according to our engagement with you.</li>
              <li><strong>Statutory Legal Compliance:</strong> Compliance with the Indian Income Tax Act 1961, Central Goods and Services Tax (CGST) Act 2017, Companies Act 2013, and related notifications.</li>
              <li><strong>Communication & Reminders:</strong> Sending deadline alerts, OTP verification codes, filing status updates, and support ticket responses via Email, WhatsApp, and push notifications.</li>
              <li><strong>Security & Audit Trails:</strong> Maintaining an immutable audit log of document uploads, downloads, and approvals as required for professional accounting standards.</li>
            </ul>
          </section>

          <!-- 4. Data Storage and Security -->
          <section>
            <h2 class="font-headline text-lg font-bold text-on-surface">4. Data Storage, Encryption and Security</h2>
            <p class="mt-2">
              We implement comprehensive technical and organizational safeguards:
            </p>
            <ul class="mt-3 list-disc space-y-1.5 pl-5">
              <li>All HTTP communications are protected with <strong>TLS 1.3 / 1.2 encryption</strong> with HSTS enabled.</li>
              <li>Uploaded financial documents are stored in secure <strong>Amazon Web Services (AWS) S3 buckets</strong> configured with restricted access and served exclusively via short-lived, cryptographically signed pre-signed URLs.</li>
              <li>Passwords are salted and cryptographically hashed; plain-text passwords are never stored or logged.</li>
              <li>Database connections are guarded behind private networks with automated daily encrypted backups.</li>
            </ul>
          </section>

          <!-- 5. Disclosure of Information -->
          <section>
            <h2 class="font-headline text-lg font-bold text-on-surface">5. Disclosure and Sharing of Information</h2>
            <p class="mt-2">
              We do NOT sell or commercially exploit your personal or business data. We only share information in the following limited circumstances:
            </p>
            <ul class="mt-3 list-disc space-y-1.5 pl-5">
              <li><strong>Government Portals & Regulators:</strong> Directly with statutory authorities (such as the Income Tax Department e-filing portal, GST Portal / GSTN, Ministry of Corporate Affairs, TRACES) strictly upon your instruction to execute filings on your behalf.</li>
              <li><strong>Infrastructure Partners:</strong> Secure cloud infrastructure providers (e.g., AWS, transactional email service SES) bound by rigorous confidentiality agreements.</li>
              <li><strong>Legal Obligations:</strong> Where mandated by a valid judicial summons, court order, or official notice issued under Indian law.</li>
            </ul>
          </section>

          <!-- 6. Data Retention -->
          <section>
            <h2 class="font-headline text-lg font-bold text-on-surface">6. Data Retention Periods</h2>
            <p class="mt-2">
              Under Indian tax legislation (including Section 149 of the Income Tax Act and Section 36 of the CGST Act), businesses and tax practitioners are obligated to preserve accounting records for a minimum of 6 to 8 financial years. Your uploaded documents and generated returns will be preserved for the statutory period or until your engagement terminates and statutory retention expires.
            </p>
          </section>

          <!-- 7. Your Rights -->
          <section>
            <h2 class="font-headline text-lg font-bold text-on-surface">7. Your Rights and Controls</h2>
            <p class="mt-2">
              In accordance with the Digital Personal Data Protection Act 2023 (DPDP Act) and applicable guidelines, you have the right to:
            </p>
            <ul class="mt-3 list-disc space-y-1.5 pl-5">
              <li><strong>Access & Download:</strong> View and download your filed reports, uploaded invoices, and profile information at any time through this portal.</li>
              <li><strong>Rectification:</strong> Request correction of inaccurate personal or tax details.</li>
              <li><strong>Withdrawal of Consent:</strong> Withdraw authorization for optional notifications or portal communications.</li>
              <li><strong>Grievance Redressal:</strong> Submit queries or concerns regarding how your data is handled directly to our office.</li>
            </ul>
          </section>

          <!-- 8. Grievance Officer & Contact -->
          <section class="rounded-xl border border-hairline bg-surface p-6 dark:border-hairline-strong dark:bg-surface-container">
            <h2 class="font-headline text-base font-bold text-on-surface">8. Data Protection & Grievance Contact</h2>
            <p class="mt-2 text-xs sm:text-sm">
              If you have any questions or wish to exercise your rights under this policy, please reach out to:
            </p>
            <div class="mt-4 space-y-1 text-xs sm:text-sm">
              <p class="font-semibold text-on-surface">CA Sanjay Bajaj</p>
              <p class="text-on-surface-variant">S N Bajaj And Co., Chartered Accountants</p>
              <p class="text-on-surface-variant">2007, Trade House, Opp. Man Darwaja Fire Station, Ring Road, Surat - 395002, Gujarat, India</p>
              <p class="text-on-surface-variant">Email: <a href="mailto:casnbajaj2015@gmail.com" class="text-secondary underline">casnbajaj2015&#64;gmail.com</a></p>
              <p class="text-on-surface-variant">Phone: <a href="tel:+919909831995" class="text-secondary underline">+91 99098 31995</a></p>
            </div>
          </section>
        </div>

        <!-- Bottom Navigation Links -->
        <div class="mt-12 flex flex-col items-center justify-between gap-4 border-t border-hairline pt-6 text-xs text-on-surface-variant sm:flex-row dark:border-hairline-strong">
          <p>© 2026 S N Bajaj And Co. All rights reserved.</p>
          <div class="flex items-center gap-4">
            <a routerLink="/terms-and-conditions" class="hover:text-primary dark:hover:text-white underline">Terms & Conditions</a>
            <span>•</span>
            <a routerLink="/signup" class="hover:text-primary dark:hover:text-white underline">Sign Up</a>
            <span>•</span>
            <a routerLink="/login" class="hover:text-primary dark:hover:text-white underline">Sign In</a>
          </div>
        </div>
      </main>
    </div>
  `,
})
export class PrivacyPolicy {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  get homeRoute(): string {
    return this.auth.isAuthenticated() ? '/dashboard' : '/login';
  }

  get homeLabel(): string {
    return this.auth.isAuthenticated() ? 'Dashboard' : 'Sign In';
  }

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      void this.router.navigate([this.homeRoute]);
    }
  }

  printPolicy(): void {
    window.print();
  }
}

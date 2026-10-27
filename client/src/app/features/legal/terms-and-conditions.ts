import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-terms-and-conditions',
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
              (click)="printTerms()"
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
            <span class="material-symbols-outlined text-[14px]">gavel</span>
            User Agreement
          </div>
          <h1 class="mt-4 font-headline text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
            Terms and Conditions
          </h1>
          <p class="mt-2 text-sm text-on-surface-variant">
            Last Updated: October 2026 • Applicable to all registered clients
          </p>
          <p class="mt-4 text-base leading-relaxed text-on-surface-variant">
            Welcome to the digital practice management and client services portal of <strong>S N Bajaj And Co. (Chartered Accountants)</strong>. By creating an account, registering on this portal, or accessing our services, you acknowledge and agree to be bound by these Terms and Conditions.
          </p>
        </div>

        <!-- Highlights Box -->
        <div class="mb-10 rounded-xl border border-hairline bg-canvas-soft p-5 dark:border-hairline-strong dark:bg-surface-container">
          <h2 class="flex items-center gap-2 font-semibold text-sm text-on-surface">
            <span class="material-symbols-outlined text-secondary text-[20px]">info</span>
            Essential Highlights
          </h2>
          <ul class="mt-3 space-y-2 text-xs leading-5 text-on-surface-variant sm:text-sm">
            <li class="flex items-start gap-2">
              <span class="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">check_circle</span>
              <span><strong>Document Timelines:</strong> To ensure on-time GST and Income Tax filings without late fees, supporting records must be uploaded well before statutory deadlines.</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">check_circle</span>
              <span><strong>Client Accuracy:</strong> You certify that all invoices, sales/purchase books, and turnover figures provided are true, complete, and bona fide.</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px]">check_circle</span>
              <span><strong>Surat Jurisdiction:</strong> All engagements and disputes are subject to the exclusive jurisdiction of the competent courts in Surat, Gujarat.</span>
            </li>
          </ul>
        </div>

        <!-- Body Sections -->
        <div class="space-y-10 text-sm leading-relaxed text-on-surface-variant">
          <!-- 1. Definitions and Acceptance -->
          <section>
            <h2 class="font-headline text-lg font-bold text-on-surface">1. Definitions and Acceptance of Terms</h2>
            <p class="mt-2">
              "Firm" or "We" refers to S N Bajaj And Co., Chartered Accountants, having office at 2007, Trade House, Ring Road, Surat. "Client" or "You" refers to the registered individual, business entity, proprietor, or authorized representative accessing this application.
            </p>
            <p class="mt-2">
              By checking the agreement box during signup or by logging into the portal, you confirm that you are at least 18 years of age, legally competent to enter into binding agreements under the Indian Contract Act 1872, and agree to these terms.
            </p>
          </section>

          <!-- 2. Services Scope -->
          <section>
            <h2 class="font-headline text-lg font-bold text-on-surface">2. Scope of Portal Services</h2>
            <p class="mt-2">
              This application functions as a secure digital interface for:
            </p>
            <ul class="mt-3 list-disc space-y-1.5 pl-5">
              <li>Document submission (GST purchase & sales invoices, bank statements, TDS certs, etc.).</li>
              <li>Delivery of filed GST returns (GSTR-1, GSTR-3B, GSTR-9), computation sheets, and challans.</li>
              <li>Automated tax filing deadline alerts and compliance reminders.</li>
              <li>Raising support tickets and communicating with our CA team.</li>
            </ul>
            <p class="mt-2">
              Access to this portal is supplementary to the specific engagement contract agreed upon between you and S N Bajaj And Co.
            </p>
          </section>

          <!-- 3. Account Responsibility & Security -->
          <section>
            <h2 class="font-headline text-lg font-bold text-on-surface">3. User Credentials and Security</h2>
            <ul class="mt-2 list-disc space-y-1.5 pl-5">
              <li>You must provide accurate, current, and complete registration information including mobile number, email, and date of birth.</li>
              <li>You are solely responsible for maintaining the confidentiality of your password and OTP credentials.</li>
              <li>Any activity originating from your authenticated session will be treated as authorized by you.</li>
              <li>Notify us immediately at <a href="mailto:casnbajaj2015@gmail.com" class="text-secondary underline">casnbajaj2015&#64;gmail.com</a> if you suspect unauthorized access or security compromise.</li>
            </ul>
          </section>

          <!-- 4. Client Obligations for Document Upload & Accuracy -->
          <section>
            <h2 class="font-headline text-lg font-bold text-on-surface">4. Document Authenticity and Filing Timelines</h2>
            <p class="mt-2">
              Timely and correct statutory filing depends on your accurate documentation:
            </p>
            <ul class="mt-3 list-disc space-y-1.5 pl-5">
              <li><strong>Submission Deadlines:</strong> For monthly GST filings (e.g. GSTR-1 and GSTR-3B), complete document sets must be uploaded by the cutoff communicated in your dashboard (typically on or before the 7th of every month). Late uploads may impede timely filing and attract statutory late fees or interest under GST laws.</li>
              <li><strong>Accuracy Guarantee:</strong> You warrant that all uploaded invoices, bank records, and GSTIN numbers reflect genuine business transactions. S N Bajaj And Co. does not fabricate, alter, or falsify financial transactions.</li>
              <li><strong>Prohibited Uploads:</strong> You agree not to upload corrupted files, malware, password-locked files without shared keys, or documents violating Indian laws.</li>
            </ul>
          </section>

          <!-- 5. Professional Fees & Taxes -->
          <section>
            <h2 class="font-headline text-lg font-bold text-on-surface">5. Professional Fees and Payment</h2>
            <p class="mt-2">
              Professional fees for statutory audit, tax return preparation, and ongoing advisory will be billed as per the agreed mutual quotation or invoice. Statutory taxes, government filing fees, and late penalties imposed by tax authorities due to delayed client document submission are payable by the client.
            </p>
          </section>

          <!-- 6. Intellectual Property -->
          <section>
            <h2 class="font-headline text-lg font-bold text-on-surface">6. Intellectual Property Rights</h2>
            <p class="mt-2">
              All portal code, user interface, brand assets, logos, templates, report formats, and proprietary computation spreadsheets remain the intellectual property of S N Bajaj And Co. You retain full ownership of all raw financial data and business documents uploaded by you.
            </p>
          </section>

          <!-- 7. Limitation of Liability -->
          <section>
            <h2 class="font-headline text-lg font-bold text-on-surface">7. Limitation of Liability & Disclaimers</h2>
            <p class="mt-2">
              While we make every endeavor to provide uninterrupted portal availability and rigorous accounting accuracy:
            </p>
            <ul class="mt-3 list-disc space-y-1.5 pl-5">
              <li>We are not liable for government portal downtimes, GSTN gateway crashes, or bank payment gateway failures.</li>
              <li>We are not responsible for penalties or interest arising from incomplete, erroneous, or delayed data submitted by the client.</li>
              <li>In no event shall S N Bajaj And Co. be liable for indirect, incidental, or consequential damages resulting from portal use or temporary downtime.</li>
            </ul>
          </section>

          <!-- 8. Termination -->
          <section>
            <h2 class="font-headline text-lg font-bold text-on-surface">8. Account Termination & Suspension</h2>
            <p class="mt-2">
              We reserve the right to suspend or terminate portal access in cases of fraudulent activity, breach of these terms, or non-payment of agreed professional fees, subject to statutory record preservation obligations under ICAI norms.
            </p>
          </section>

          <!-- 9. Governing Law and Dispute Resolution -->
          <section class="rounded-xl border border-hairline bg-surface p-6 dark:border-hairline-strong dark:bg-surface-container">
            <h2 class="font-headline text-base font-bold text-on-surface">9. Governing Law & Jurisdiction</h2>
            <p class="mt-2 text-xs sm:text-sm">
              These Terms and Conditions shall be governed by and construed in accordance with the laws of the Republic of India. Any controversy, claim, or dispute arising out of or related to these terms shall be submitted to the exclusive jurisdiction of the competent courts in <strong>Surat, Gujarat, India</strong>.
            </p>
            <div class="mt-4 text-xs sm:text-sm text-on-surface-variant">
              <p>For questions or formal correspondence:</p>
              <p class="font-semibold text-on-surface mt-1">S N Bajaj And Co., Chartered Accountants</p>
              <p>2007, Trade House, Ring Road, Surat - 395002 | Email: casnbajaj2015&#64;gmail.com</p>
            </div>
          </section>
        </div>

        <!-- Bottom Navigation Links -->
        <div class="mt-12 flex flex-col items-center justify-between gap-4 border-t border-hairline pt-6 text-xs text-on-surface-variant sm:flex-row dark:border-hairline-strong">
          <p>© 2026 S N Bajaj And Co. All rights reserved.</p>
          <div class="flex items-center gap-4">
            <a routerLink="/privacy-policy" class="hover:text-primary dark:hover:text-white underline">Privacy Policy</a>
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
export class TermsConditions {
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

  printTerms(): void {
    window.print();
  }
}

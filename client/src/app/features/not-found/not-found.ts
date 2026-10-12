import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh flex-col items-center justify-center bg-surface-container-lowest px-4 py-12 text-center text-on-surface font-geist antialiased sm:px-6">
      <div class="w-full max-w-md">
        <!-- Logo Header -->
        <div class="mb-8 flex justify-center">
          <a [routerLink]="homeRoute" class="inline-flex items-center gap-2">
            <img src="/logo-transparent.png" alt="S N Bajaj And Co" class="h-16 w-auto object-contain sm:h-20" onerror="this.src='/logo-login.png'" />
          </a>
        </div>

        <!-- 404 Illustration / Graphic Container -->
        <div class="relative mx-auto mb-6 flex size-24 items-center justify-center rounded-2xl border border-hairline bg-canvas-soft shadow-sm dark:border-hairline-strong dark:bg-surface-container">
          <span class="material-symbols-outlined text-[44px] text-secondary">travel_explore</span>
          <span class="absolute -top-2 -right-2 flex items-center justify-center rounded-full bg-primary px-2 py-0.5 font-geist-mono text-[11px] font-bold text-on-primary dark:bg-white dark:text-black">
            404
          </span>
        </div>

        <!-- Main Copy -->
        <h1 class="font-headline text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
          Page Not Found
        </h1>
        <p class="mt-3 text-sm leading-relaxed text-on-surface-variant sm:text-base">
          The page or document link you requested could not be found. It may have been moved, renamed, or is temporarily unavailable.
        </p>

        <!-- Action Buttons -->
        <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            [routerLink]="homeRoute"
            class="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-on-primary transition-all hover:opacity-90 active:scale-[0.98] dark:bg-white dark:text-black"
          >
            <span class="material-symbols-outlined text-[18px]">home</span>
            <span>{{ homeLabel }}</span>
          </a>

          <button
            type="button"
            (click)="goBack()"
            class="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-hairline bg-surface px-6 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container active:scale-[0.98] dark:border-hairline-strong dark:bg-surface-container"
          >
            <span class="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Go Back</span>
          </button>
        </div>

        <!-- Quick Helpful Links -->
        <div class="mt-10 rounded-xl border border-hairline bg-canvas-soft p-4 dark:border-hairline-strong dark:bg-surface-container">
          <p class="font-geist-mono text-[11px] font-semibold uppercase tracking-wider text-secondary">
            Quick Navigation
          </p>
          <div class="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-on-surface-variant">
            @if (isAuthenticated) {
              <a routerLink="/documents" class="hover:text-primary dark:hover:text-white underline">Documents</a>
              <span>•</span>
              <a routerLink="/reports" class="hover:text-primary dark:hover:text-white underline">Reports</a>
              <span>•</span>
              <a routerLink="/support" class="hover:text-primary dark:hover:text-white underline">Support</a>
              <span>•</span>
            } @else {
              <a routerLink="/login" class="hover:text-primary dark:hover:text-white underline">Sign In</a>
              <span>•</span>
              <a routerLink="/signup" class="hover:text-primary dark:hover:text-white underline">Create Account</a>
              <span>•</span>
            }
            <a routerLink="/privacy-policy" class="hover:text-primary dark:hover:text-white underline">Privacy Policy</a>
            <span>•</span>
            <a routerLink="/terms-and-conditions" class="hover:text-primary dark:hover:text-white underline">Terms</a>
          </div>
        </div>

        <!-- Footer -->
        <footer class="mt-8">
          <p class="font-geist-mono text-xs tracking-wider text-secondary">
            S N Bajaj And Co. • Chartered Accountants
          </p>
        </footer>
      </div>
    </div>
  `,
})
export class NotFound {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  get isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  get homeRoute(): string {
    return this.isAuthenticated ? '/dashboard' : '/login';
  }

  get homeLabel(): string {
    return this.isAuthenticated ? 'Back to Dashboard' : 'Back to Sign In';
  }

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      void this.router.navigate([this.homeRoute]);
    }
  }
}

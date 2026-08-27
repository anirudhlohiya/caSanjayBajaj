import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh flex-col bg-neutral-50">
      <!-- Hero header — unified branding across all auth screens -->
      <div class="relative overflow-hidden bg-neutral-950 px-6 pb-16 pt-12 text-white">
        <div class="flex items-center gap-3">
          <div class="flex size-12 items-center justify-center rounded-xl bg-white/10 overflow-hidden border border-white/20 p-1.5 shrink-0">
            <img
              src="/logo-login.png"
              alt="S N Bajaj And Co Logo"
              class="h-full w-full object-contain"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
            />
            <span class="material-symbols-outlined text-white text-[26px] hidden items-center justify-center">account_balance</span>
          </div>
          <div class="min-w-0">
            <h1 class="text-lg font-bold tracking-tight">S N Bajaj And Co</h1>
            <p class="text-xs text-white/60 mt-0.5">Chartered Accountants</p>
          </div>
        </div>
        <p class="mt-8 text-2xl font-bold tracking-tight">{{ heroTitle() }}</p>
        <p class="mt-1 text-sm text-white/70">{{ heroSubtitle() }}</p>
        <!-- decorative geometric accent -->
        <div class="absolute -right-8 -top-8 size-48 rounded-full bg-white/5 pointer-events-none"></div>
        <div class="absolute -right-4 top-16 size-24 rounded-full bg-white/5 pointer-events-none"></div>
      </div>

      <div class="-mt-8 flex-1 rounded-t-3xl bg-white px-6 pt-8 shadow-xl">
        <ng-content></ng-content>
        <p class="mt-6 pb-6 text-center text-xs text-neutral-400">
          Provided to you by
          <span class="font-semibold text-neutral-600">S N Bajaj And Co</span>
        </p>
      </div>
    </div>
  `,
})
export class AuthLayout {
  readonly heroTitle = input.required<string>();
  readonly heroSubtitle = input.required<string>();
}

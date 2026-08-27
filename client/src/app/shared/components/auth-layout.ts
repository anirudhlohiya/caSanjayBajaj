import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh flex-col bg-neutral-50">
      <!-- Hero header — unified branding across all auth screens -->
      <div class="relative overflow-hidden bg-neutral-950 px-6 pb-16 pt-10 text-white">
        <div class="flex flex-col items-center gap-3">
          <div class="flex size-20 items-center justify-center rounded-full overflow-hidden shrink-0 shadow-lg ring-2 ring-white/20">
            <img
              src="/logo-login.png"
              alt="S N Bajaj And Co Logo"
              class="h-full w-full object-cover"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
            />
            <span class="material-symbols-outlined text-white text-[26px] items-center justify-center" style="display:none">account_balance</span>
          </div>
          <div class="text-center">
            <h1 class="text-lg font-bold tracking-tight">S N Bajaj And Co</h1>
            <p class="text-xs text-white/60 mt-0.5">Chartered Accountants</p>
          </div>
        </div>
        <p class="mt-6 text-center text-2xl font-bold tracking-tight">{{ heroTitle() }}</p>
        <p class="mt-1 text-center text-sm text-white/70">{{ heroSubtitle() }}</p>
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

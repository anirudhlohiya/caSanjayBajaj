import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- One background for the whole screen: no colour split between the logo and the form. -->
    <div class="bg-surface text-on-surface min-h-dvh w-full flex justify-center antialiased">
      <div class="w-full max-w-md px-6 pt-10 pb-6 flex flex-col">
        @if (showLogo()) {
          <div class="flex flex-col items-center text-center gap-2.5">
            <img
              alt="S N Bajaj And Co logo"
              src="/logo-round.webp"
              width="92"
              height="92"
              class="size-[92px] rounded-full ring-2 ring-gold"
            />
            <p class="mt-1.5 text-[21px] font-semibold tracking-tight text-brand-ink">S N Bajaj &amp; Co</p>
            <span class="h-0.5 w-9 rounded-full bg-gold" aria-hidden="true"></span>
            <p class="text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              Chartered Accountants · Surat
            </p>
          </div>
        }

        @if (heroTitle()) {
          <h1 [class]="'text-[22px] font-semibold tracking-tight text-primary ' + (showLogo() ? 'mt-9' : '')">
            {{ heroTitle() }}
          </h1>
        }
        @if (heroSubtitle()) {
          <p class="mt-1 text-sm text-on-surface-variant">{{ heroSubtitle() }}</p>
        }

        <div class="mt-6">
          <ng-content></ng-content>
        </div>

        <footer class="mt-auto pt-10 text-center space-y-1.5">
          <div class="flex items-center justify-center gap-3 text-xs text-on-surface-variant">
            <a routerLink="/terms-and-conditions" class="py-2 hover:text-primary transition-colors">Terms &amp; Conditions</a>
            <span aria-hidden="true">·</span>
            <a routerLink="/privacy-policy" class="py-2 hover:text-primary transition-colors">Privacy Policy</a>
          </div>
          <p class="text-xs text-on-surface-variant">Provided to you by S N Bajaj And Co</p>
        </footer>
      </div>
    </div>
  `,
})
export class AuthLayout {
  readonly heroTitle = input<string>();
  readonly heroSubtitle = input<string>();
  readonly showLogo = input<boolean>(true);
}

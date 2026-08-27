import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh flex-col items-center justify-center bg-surface px-6 text-center">
      <div class="mb-4 flex size-16 items-center justify-center rounded-full bg-surface-variant">
        <span class="material-symbols-outlined text-on-surface-variant" style="font-size: 34px">explore_off</span>
      </div>
      <p class="font-headline-lg text-headline-lg text-secondary">404</p>
      <p class="mt-2 text-title-lg font-semibold text-on-surface">Page not found</p>
      <p class="mt-1 max-w-xs text-body-md text-on-surface-variant">
        The page you are looking for doesn't exist or may have been moved.
      </p>
      <a
        routerLink="/dashboard"
        class="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-primary px-6 text-body-lg font-semibold text-on-primary"
      >
        <span class="material-symbols-outlined" style="font-size: 20px">home</span>
        Go to Dashboard
      </a>
    </div>
  `,
})
export class NotFound {}

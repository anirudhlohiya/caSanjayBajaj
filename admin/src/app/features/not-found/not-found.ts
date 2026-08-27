import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <span class="material-symbols-outlined text-outline-variant" style="font-size: 56px">explore_off</span>
      <p class="mt-md font-headline-lg text-headline-lg text-on-surface">404</p>
      <p class="mt-sm font-title-lg text-title-lg text-on-surface">Page not found</p>
      <p class="mt-xs max-w-sm font-body-md text-body-md text-on-surface-variant">
        The page you are looking for doesn't exist or may have been moved.
      </p>
      <a
        routerLink="/dashboard"
        class="mt-lg inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-body-md font-medium text-on-primary hover:bg-secondary"
      >
        <span class="material-symbols-outlined" style="font-size: 18px">home</span>
        Go to Dashboard
      </a>
    </div>
  `,
})
export class NotFound {}

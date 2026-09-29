import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { resolveNav } from '../../core/services/nav-map';

@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-3">
      @if (back()) {
        <button
          (click)="goBack()"
          class="flex size-10 items-center justify-center rounded-full text-on-surface hover:bg-surface-variant shrink-0"
          aria-label="Go back"
        >
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
      }
      <div class="min-w-0 flex-1">
        <h1 class="text-xl font-bold tracking-tight text-neutral-950 dark:text-white leading-tight">
          {{ title() }}
        </h1>
        @if (subtitle()) {
          <p class="text-sm text-neutral-500 dark:text-neutral-400 leading-snug text-wrap">
            {{ subtitle() }}
          </p>
        }
      </div>
      <div class="shrink-0">
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly back = input(false);
  /** Optional override. When omitted, back resolves to the route's logical parent. */
  readonly onBack = input<(() => void) | null>(null);

  private readonly router = inject(Router);

  goBack(): void {
    const custom = this.onBack();
    if (custom) {
      custom();
      return;
    }
    // Resolved from the nav map rather than `history.back()`, so a deep link into
    // this screen cannot drop the user out of the app. `replaceUrl` keeps the
    // parent from being left in the history stack twice.
    const parent = resolveNav(this.router.url).backTo;
    void this.router.navigateByUrl(parent ?? '/dashboard', { replaceUrl: true });
  }
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

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
  readonly onBack = input<() => void>(() => history.back());

  goBack(): void {
    const fn = this.onBack();
    if (fn) {
      fn();
    }
  }
}
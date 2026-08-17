import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-3">
      @if (back()) {
        <button
          (click)="onBack()"
          class="flex size-10 items-center justify-center rounded-full text-on-surface hover:bg-surface-variant"
          aria-label="Go back"
        >
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
      }
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-headline-sm font-semibold text-on-surface">
          {{ title() }}
        </h1>
        @if (subtitle()) {
          <p class="truncate text-body-md text-on-surface-variant">
            {{ subtitle() }}
          </p>
        }
      </div>
      <ng-content></ng-content>
    </div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly back = input(false);
  readonly onBack = input<() => void>(() => history.back());
}
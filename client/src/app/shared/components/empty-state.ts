import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center px-8 py-12 text-center">
      <div
        class="mb-3 flex size-14 items-center justify-center rounded-full bg-surface-variant"
      >
        <span class="material-symbols-outlined text-on-surface-variant">
          {{ icon() }}
        </span>
      </div>
      <p class="text-title-lg font-semibold text-on-surface">{{ title() }}</p>
      @if (message()) {
        <p class="mt-1 max-w-xs text-body-md text-on-surface-variant">
          {{ message() }}
        </p>
      }
      <ng-content></ng-content>
    </div>
  `,
})
export class EmptyState {
  readonly icon = input('inbox');
  readonly title = input('Nothing here yet');
  readonly message = input('');
}
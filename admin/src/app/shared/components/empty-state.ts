import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center py-xl text-center">
      <span class="material-symbols-outlined text-outline-variant" style="font-size: 40px">
        {{ icon() }}
      </span>
      <p class="mt-md font-body-md text-body-md text-on-surface-variant">
        {{ message() }}
      </p>
      @if (hint()) {
        <p class="mt-xs font-body-sm text-body-sm text-outline">{{ hint() }}</p>
      }
    </div>
  `,
})
export class EmptyState {
  readonly icon = input('inbox');
  readonly message = input('No data to show');
  readonly hint = input('');
}
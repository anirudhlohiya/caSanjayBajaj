import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap justify-between items-end gap-4 mb-6">
      <div>
        <h1 class="font-headline-lg text-headline-lg font-bold text-on-surface">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="text-on-surface-variant mt-1">{{ subtitle() }}</p>
        }
      </div>
      <div class="flex gap-2">
        <ng-content />
      </div>
    </div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap justify-between items-end gap-md mb-lg">
      <div>
        <h1 class="font-headline-lg text-headline-lg font-bold text-on-surface">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="text-on-surface-variant mt-xs">{{ subtitle() }}</p>
        }
      </div>
      <div class="flex gap-sm">
        <ng-content />
      </div>
    </div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
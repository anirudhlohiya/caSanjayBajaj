import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-center py-lg">
      <div
        class="border-2 border-secondary border-t-transparent rounded-full animate-spin"
        [class]="size()"
      ></div>
    </div>
  `,
})
export class Spinner {
  readonly size = input('w-8 h-8');
}
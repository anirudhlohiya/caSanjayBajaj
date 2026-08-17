import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-center py-10">
      <div
        class="size-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary"
      ></div>
    </div>
  `,
})
export class Spinner {
  readonly full = input(false);
}
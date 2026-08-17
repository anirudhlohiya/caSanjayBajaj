import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-md">
        <div class="absolute inset-0 bg-black/40" (click)="close.emit()"></div>
        <div
          class="relative bg-surface-container-lowest border border-outline-variant rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <ng-content />
        </div>
      </div>
    }
  `,
})
export class Modal {
  readonly open = input(false);
  readonly close = output<void>();
}
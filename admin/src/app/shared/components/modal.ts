import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Centred dialog (confirmations) or, with variant="panel", a form panel that slides in from the right. */
@Component({
  selector: 'app-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'open() && close.emit()' },
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 flex" [class]="variant() === 'panel' ? 'justify-end' : 'items-center justify-center p-4'">
        <div class="absolute inset-0 bg-[#060b17]/50" (click)="close.emit()"></div>
        <div
          role="dialog"
          aria-modal="true"
          class="relative w-full overflow-y-auto bg-surface-container-lowest border-outline-variant"
          [class]="
            variant() === 'panel'
              ? 'panel-in h-full max-w-xl border-l shadow-2xl'
              : 'max-w-lg max-h-[90vh] border rounded-2xl shadow-lg'
          "
        >
          <ng-content />
        </div>
      </div>
    }
  `,
  styles: `
    .panel-in { animation: panel-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1); }
    @keyframes panel-in { from { transform: translateX(32px); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .panel-in { animation: none; } }
  `,
})
export class Modal {
  readonly open = input(false);
  readonly variant = input<'dialog' | 'panel'>('dialog');
  readonly close = output<void>();
}

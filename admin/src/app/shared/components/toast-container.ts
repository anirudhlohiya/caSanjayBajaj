import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed top-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 sm:w-80">
      @for (toast of toastService.toasts | async; track toast.id) {
        <div
          class="flex items-start gap-2 p-3 rounded-lg border shadow-[0_4px_12px_rgba(0,0,0,0.08)] bg-surface-container-lowest text-on-surface"
          [class.border-error-container]="toast.type === 'error'"
          [class.border-secondary-fixed-dim]="toast.type !== 'error'"
        >
          <span
            class="material-symbols-outlined text-[18px] shrink-0"
            [class.text-error]="toast.type === 'error'"
            [class.text-on-secondary-container]="toast.type === 'success'"
            [class.text-on-surface-variant]="toast.type === 'info'"
          >
            {{ toast.type === 'error' ? 'error' : toast.type === 'success' ? 'check_circle' : 'info' }}
          </span>
          <span class="flex-1 text-body-sm text-body-sm">{{ toast.message }}</span>
          <button class="text-on-surface-variant hover:text-on-surface" (click)="toastService.dismiss(toast.id)">
            <span class="material-symbols-outlined" style="font-size: 16px">close</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainer {
  readonly toastService = inject(ToastService);
}
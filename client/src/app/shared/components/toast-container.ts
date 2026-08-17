import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          [class]="
            'pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl px-4 py-3 text-body-md shadow-modal ' +
            (toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : toast.type === 'error'
                ? 'bg-error-container text-on-error-container border border-error/20'
                : 'bg-surface-container-lowest text-on-surface border border-card-border')
          "
        >
          <span class="material-symbols-outlined text-[20px] shrink-0">
            {{ toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info' }}
          </span>
          <span class="flex-1">{{ toast.message }}</span>
          <button (click)="toastService.dismiss(toast.id)" class="shrink-0 opacity-60">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainer {
  constructor(readonly toastService: ToastService) {}
}
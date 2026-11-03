import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { NavHistoryService } from '../../core/services/nav-history.service';

@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-3">
      @if (back()) {
        <button
          (click)="goBack()"
          class="flex size-10 items-center justify-center rounded-full text-on-surface hover:bg-surface-variant shrink-0"
          aria-label="Go back"
        >
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
      }
      <div class="min-w-0 flex-1">
        <h1 class="text-xl font-semibold tracking-tight text-primary leading-tight">
          {{ title() }}
        </h1>
        @if (subtitle()) {
          <p class="text-[13px] text-on-surface-variant leading-snug text-wrap">
            {{ subtitle() }}
          </p>
        }
      </div>
      <div class="shrink-0">
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly back = input(false);
  /** Optional override. When omitted, back goes to the previous page (or the route's parent). */
  readonly onBack = input<(() => void) | null>(null);

  private readonly navHistory = inject(NavHistoryService);

  goBack(): void {
    const custom = this.onBack();
    if (custom) {
      custom();
      return;
    }
    this.navHistory.back();
  }
}

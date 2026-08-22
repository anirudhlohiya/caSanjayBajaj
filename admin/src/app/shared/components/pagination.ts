import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center justify-between gap-sm">
      <span class="text-body-sm text-on-surface-variant px-sm">
        Showing {{ start() }} to {{ end() }} of {{ total() }} entries
      </span>
      <div class="flex gap-xs">
        <button
          class="p-1 rounded text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed"
          (click)="go(page() - 1)"
          [disabled]="page() <= 1"
          aria-label="Previous page"
        >
          <span class="material-symbols-outlined">chevron_left</span>
        </button>
        @for (p of pages(); track $index) {
          @if (p === '…') {
            <span
              class="w-8 h-8 rounded font-label-md text-label-md text-on-surface-variant flex items-center justify-center select-none"
              >…</span
            >
          } @else {
            <button
              class="w-8 h-8 rounded font-label-md text-label-md transition-colors"
              [class.bg-secondary]="p === page()"
              [class.text-on-secondary]="p === page()"
              [class.text-on-surface]="p !== page()"
              [class.hover:bg-surface-container-high]="p !== page()"
              (click)="go(p)"
            >
              {{ p }}
            </button>
          }
        }
        <button
          class="p-1 rounded text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed"
          (click)="go(page() + 1)"
          [disabled]="page() >= totalPages()"
          aria-label="Next page"
        >
          <span class="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
    </div>
  `,
})
export class Pagination {
  readonly page = input(1);
  readonly pageSize = input(20);
  readonly total = input(0);
  readonly totalPages = input(0);
  readonly pageChange = output<number>();

  readonly start = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1,
  );
  readonly end = computed(() =>
    Math.min(this.page() * this.pageSize(), this.total()),
  );

  readonly pages = computed<(number | '…')[]>(() => {
    const total = this.totalPages();
    const current = this.page();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const set = new Set<number>([1, total, current - 1, current, current + 1]);
    const sorted = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
    const out: (number | '…')[] = [];
    let prev = 0;
    for (const p of sorted) {
      if (p - prev > 1) out.push('…');
      out.push(p);
      prev = p;
    }
    return out;
  });

  go(page: number): void {
    if (page >= 1 && page <= this.totalPages() && page !== this.page()) {
      this.pageChange.emit(page);
    }
  }
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const GREEN = 'inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#E8F5E9] text-[#1B5E20]';
const AMBER = 'inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#FFF3E0] text-[#E65100]';
const BLUE = 'inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-secondary-fixed-dim/40 text-on-secondary-container';
const RED = 'inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-error-container text-on-error-container';
const GREY = 'inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-surface-container text-on-surface-variant';

@Component({
  selector: 'app-status-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="chipClass()">{{ label() }}</span>`,
  styles: [':host { display: inline-flex; }'],
})
export class StatusChip {
  readonly status = input.required<string>();
  readonly label = computed(() => {
    const s = this.status();
    switch (s) {
      case 'received':
        return 'Pending review';
      default:
        return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
  });

  readonly chipClass = computed(() => {
    switch (this.status()) {
      case 'processed':
      case 'sent':
      case 'active':
      case 'completed':
        return GREEN;
      case 'received':
        return AMBER;
      case 'pending':
      case 'queued':
      case 'open':
        return BLUE;
      case 'failed':
      case 'inactive':
      case 'overdue':
        return RED;
      default:
        return GREY;
    }
  });
}
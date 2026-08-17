import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

const AMBER =
  'inline-flex items-center px-2.5 py-0.5 rounded-full text-label-lg font-semibold bg-amber-100 text-amber-800';
const EMERALD =
  'inline-flex items-center px-2.5 py-0.5 rounded-full text-label-lg font-semibold bg-emerald-100 text-emerald-800';
const BLUE =
  'inline-flex items-center px-2.5 py-0.5 rounded-full text-label-lg font-semibold bg-report-ready-bg text-report-ready';
const RED =
  'inline-flex items-center px-2.5 py-0.5 rounded-full text-label-lg font-semibold bg-error-container text-on-error-container';
const GREY =
  'inline-flex items-center px-2.5 py-0.5 rounded-full text-label-lg font-semibold bg-surface-variant text-on-surface-variant';

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
      case 'processed':
        return 'Processed';
      case 'received':
        return 'Received';
      case 'pending':
        return 'Pending';
      case 'sent':
        return 'Sent';
      case 'ready':
        return 'Report Ready';
      default:
        return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
  });

  readonly chipClass = computed(() => {
    switch (this.status()) {
      case 'processed':
      case 'sent':
      case 'completed':
      case 'ready':
        return BLUE;
      case 'received':
        return EMERALD;
      case 'pending':
      case 'queued':
      case 'open':
        return AMBER;
      case 'failed':
      case 'overdue':
        return RED;
      default:
        return GREY;
    }
  });
}
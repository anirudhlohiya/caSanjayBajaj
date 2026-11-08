import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ComplianceTasksService, ComplianceTask } from '../../core/services/feature.services';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';
import { GovSources } from '../../shared/components/gov-sources';

const DAY = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-reminders',
  standalone: true,
  imports: [CommonModule, Spinner, EmptyState, GovSources],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reminders.html',
})
export class Reminders {
  private readonly tasksService = inject(ComplianceTasksService);
  private readonly authService = inject(AuthService);

  readonly loading = signal(true);
  readonly tasks = signal<ComplianceTask[]>([]);
  /** Completed reminders stay folded until asked for. */
  readonly showCompleted = signal(false);

  readonly isQuarterly = computed(
    () => this.authService.userProfile()?.gst_filing_frequency === 'quarterly',
  );

  readonly groupedTasks = computed(() => {
    const all = this.tasks();
    return {
      needsAttention: all.filter((t) => this.isNeedsAttention(t)),
      upcoming: all.filter(
        (t) => t.status === 'pending' && !this.isNeedsAttention(t),
      ),
      completed: all.filter((t) => t.status === 'completed'),
    };
  });

  readonly counts = computed(() => {
    const g = this.groupedTasks();
    return {
      needsAttention: g.needsAttention.length,
      upcoming: g.upcoming.length,
      completed: g.completed.length,
    };
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      // Fetch tasks across all periods (docs/13 §4 reminder sources).
      const result = await this.tasksService.list();
      this.tasks.set(result);
    } catch {
      this.tasks.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private dueFor(task: ComplianceTask): Date | null {
    const schedule = task.filing_period?.schedule;
    if (!schedule) return null;
    const key = task.category === 'gstr_1' ? 'gstr1' : task.category;
    const entry =
      key === 'gstr_3b' && this.isQuarterly()
        ? schedule?.['quarterly']?.gstr3b
        : schedule?.[key];
    const due = entry?.due;
    return typeof due === 'string' ? new Date(`${due}T23:59:59`) : null;
  }

  isNeedsAttention(task: ComplianceTask): boolean {
    if (task.status === 'nil_declared') return true;
    if (task.status !== 'pending') return false;
    const due = this.dueFor(task);
    if (!due) return false;
    return due.getTime() - Date.now() <= 2 * DAY;
  }

  getTaskIcon(category: string): string {
    if (category === 'gst_payment') return 'currency_rupee';
    if (category === 'gstr_1') return 'description';
    if (category === 'gstr_3b') return 'fact_check';
    if (category === 'iff') return 'calendar_month';
    return 'description';
  }

  /** "GSTR-1", "GSTR-3B", "IFF", "GST Payment". */
  taskLabel(category: string): string {
    const known: Record<string, string> = { gstr_1: 'GSTR-1', gstr_3b: 'GSTR-3B', iff: 'IFF', gst_payment: 'GST Payment' };
    return known[category] ?? category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** Whole days until the date shown on the card; null when there is none or it has passed. */
  daysLeft(task: ComplianceTask): number | null {
    const due = task.due_date || task.filing_period?.due_date;
    if (!due) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((new Date(`${due.slice(0, 10)}T00:00:00`).getTime() - today.getTime()) / DAY);
    return days > 0 ? days : null;
  }

  cadenceLabel(task: ComplianceTask): string {
    if (task.category === 'iff') return 'Quarterly';
    if (task.category === 'gstr_3b' && this.isQuarterly()) return 'Quarterly';
    return 'Monthly';
  }
}
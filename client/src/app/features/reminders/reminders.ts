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

const DAY = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-reminders',
  standalone: true,
  imports: [CommonModule, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reminders.html',
})
export class Reminders {
  private readonly tasksService = inject(ComplianceTasksService);
  private readonly authService = inject(AuthService);

  readonly loading = signal(true);
  readonly tasks = signal<ComplianceTask[]>([]);

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

  cadenceLabel(task: ComplianceTask): string {
    if (task.category === 'iff') return 'Quarterly';
    if (task.category === 'gstr_3b' && this.isQuarterly()) return 'Quarterly';
    return 'Monthly';
  }
}
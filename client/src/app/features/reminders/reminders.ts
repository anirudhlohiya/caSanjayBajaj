import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../core/services/toast.service';
import { ComplianceTasksService, ComplianceTask } from '../../core/services/feature.services';
import { Spinner } from '../../shared/components/spinner';

@Component({
  selector: 'app-reminders',
  standalone: true,
  imports: [CommonModule, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reminders.html',
})
export class Reminders {
  private readonly tasksService = inject(ComplianceTasksService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly tasks = signal<ComplianceTask[]>([]);

  readonly groupedTasks = computed(() => {
    const all = this.tasks();
    return {
      needsAttention: all.filter(t => t.status === 'overdue' || (t.status === 'pending' && this.isNeedsAttention(t))),
      upcoming: all.filter(t => t.status === 'pending' && !this.isNeedsAttention(t)),
      completed: all.filter(t => t.status === 'completed'),
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
      // Fetch all tasks for all periods by omitting periodId
      const result = await this.tasksService.list();
      this.tasks.set(result);
    } catch {
      this.tasks.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  getTaskIcon(category: string): string {
    if (category === 'gst_payment') return 'currency_rupee';
    if (category.includes('bills') || category === 'purchase_documents' || category === 'sales_documents') return 'image';
    return 'calendar_month';
  }

  isNeedsAttention(task: ComplianceTask): boolean {
    // For mockup purposes, say gst_payment and purchase_bills are needs attention,
    // and others are upcoming.
    if (task.category === 'gst_payment' && task.amount) return true;
    if (task.category === 'purchase_bills' || task.category === 'sales_bills') return true;
    return false;
  }

  isMonthly(task: ComplianceTask): boolean {
    // In real app, this would be determined by user profile or period logic
    // We mock it for the UI
    if (task.category === 'iff' || task.category === 'gstr_3b') return false; // Quarterly
    return true; // Monthly
  }
}

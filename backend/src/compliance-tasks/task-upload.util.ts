import { In, Repository } from 'typeorm';
import { ComplianceCategory, TaskStatus } from '../common/enums';
import { ComplianceTask } from '../entities/compliance-task.entity';

/**
 * Advances the client's first still-open filing task for a period to
 * UPLOADED once a GST document lands for it (docs/13 §5.2). This is what
 * stops the task-slack reminders once evidence is on file. Shared by the app
 * upload confirm, WhatsApp uploads and the admin "assign month" action.
 * Returns null when nothing is pending.
 */
export async function advanceFilingTaskOnUpload(
  tasks: Repository<ComplianceTask>,
  userId: string,
  periodId: string,
): Promise<ComplianceTask | null> {
  const task = await tasks.findOne({
    where: {
      user_id: userId,
      filing_period_id: periodId,
      category: In([
        ComplianceCategory.GSTR_1,
        ComplianceCategory.GSTR_3B,
        ComplianceCategory.IFF,
      ]),
      status: TaskStatus.PENDING,
    },
    order: { created_at: 'ASC' },
  });
  if (!task) return null;

  task.status = TaskStatus.UPLOADED;
  return tasks.save(task);
}

/** Current Indian assessment year in YYYY-YY form (AY starts 1 April). */
export function currentAssessmentYear(now: Date = new Date()): string {
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
}

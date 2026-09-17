import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComplianceTask } from '../entities';
import { ComplianceCategory, TaskStatus } from '../common/enums';

@Injectable()
export class ComplianceTasksService {
  constructor(
    @InjectRepository(ComplianceTask)
    private readonly tasksRepository: Repository<ComplianceTask>,
  ) {}

  async listForClient(userId: string, periodId?: string): Promise<ComplianceTask[]> {
    const where: any = { user_id: userId };
    if (periodId) where.filing_period_id = periodId;

    return this.tasksRepository.find({
      where,
      relations: { filing_period: true },
      order: { created_at: 'ASC' },
    });
  }

  async autoGenerateTasks(userId: string, periodId: string, isQuarterly: boolean): Promise<ComplianceTask[]> {
    const existing = await this.listForClient(userId, periodId);
    if (existing.length > 0) return existing;

    const categories = [
      ComplianceCategory.GSTR_1,
      ComplianceCategory.SALES_BILLS,
      ComplianceCategory.PURCHASE_BILLS,
      ComplianceCategory.GSTR_3B,
      ComplianceCategory.GST_PAYMENT,
    ];

    if (isQuarterly) {
      categories.push(ComplianceCategory.IFF);
    }

    const tasks = categories.map((cat) => {
      const task = new ComplianceTask();
      task.user_id = userId;
      task.filing_period_id = periodId;
      task.category = cat;
      task.status = TaskStatus.PENDING;
      return task;
    });

    return this.tasksRepository.save(tasks);
  }

  async updatePayment(id: string, amount: string | null, paidAt: Date | null): Promise<ComplianceTask> {
    const task = await this.tasksRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    
    task.amount = amount;
    if (paidAt) {
      task.paid_at = paidAt;
      task.status = TaskStatus.COMPLETED;
    } else {
      task.paid_at = null;
      task.status = TaskStatus.PENDING;
    }
    return this.tasksRepository.save(task);
  }

  async updateStatus(id: string, status: TaskStatus): Promise<ComplianceTask> {
    const task = await this.tasksRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    task.status = status;
    return this.tasksRepository.save(task);
  }
}

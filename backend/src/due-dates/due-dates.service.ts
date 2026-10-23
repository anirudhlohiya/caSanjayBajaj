import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DueDate } from '../entities/due-date.entity';
import { CreateDueDateDto, UpdateDueDateDto } from './dto/due-date.dto';

/** "2026-27" for dates from 1 Apr 2026 to 31 Mar 2027. */
export function currentFy(today = new Date()): string {
  const start =
    today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

@Injectable()
export class DueDatesService {
  constructor(
    @InjectRepository(DueDate)
    private readonly dueDates: Repository<DueDate>,
  ) {}

  /** Active deadlines of a financial year (defaults to the current one). */
  listActive(fy = currentFy()): Promise<DueDate[]> {
    return this.dueDates.find({
      where: { fy, is_active: true },
      order: { due_date: 'ASC', title: 'ASC' },
    });
  }

  listAll(fy = currentFy()): Promise<DueDate[]> {
    return this.dueDates.find({
      where: { fy },
      order: { due_date: 'ASC', title: 'ASC' },
    });
  }

  /** Financial years that have data, newest first (for the admin year picker). */
  async years(): Promise<string[]> {
    const rows: Array<{ fy: string }> = await this.dueDates
      .createQueryBuilder('d')
      .select('DISTINCT d.fy', 'fy')
      .orderBy('fy', 'DESC')
      .getRawMany();
    return rows.map((r) => r.fy);
  }

  async findOne(id: string): Promise<DueDate> {
    const row = await this.dueDates.findOneBy({ id });
    if (!row) throw new NotFoundException('Due date not found');
    return row;
  }

  create(dto: CreateDueDateDto): Promise<DueDate> {
    return this.dueDates.save(
      this.dueDates.create({
        title: dto.title.trim(),
        form: dto.form?.trim() || null,
        category: dto.category,
        due_date: dto.due_date,
        original_due_date: dto.original_due_date || null,
        period_label: dto.period_label?.trim() || null,
        description: dto.description?.trim() ?? '',
        audiences: dto.audiences,
        fy: dto.fy,
        is_active: dto.is_active ?? true,
      }),
    );
  }

  async update(id: string, dto: UpdateDueDateDto): Promise<DueDate> {
    const row = await this.findOne(id);
    if (dto.title !== undefined) row.title = dto.title.trim();
    if (dto.form !== undefined) row.form = dto.form.trim() || null;
    if (dto.category !== undefined) row.category = dto.category;
    if (dto.due_date !== undefined) row.due_date = dto.due_date;
    if (dto.original_due_date !== undefined) {
      row.original_due_date = dto.original_due_date || null;
    }
    if (dto.period_label !== undefined) {
      row.period_label = dto.period_label.trim() || null;
    }
    if (dto.description !== undefined) {
      row.description = dto.description.trim();
    }
    if (dto.audiences !== undefined) row.audiences = dto.audiences;
    if (dto.fy !== undefined) row.fy = dto.fy;
    if (dto.is_active !== undefined) row.is_active = dto.is_active;
    return this.dueDates.save(row);
  }

  async remove(id: string): Promise<void> {
    const row = await this.findOne(id);
    await this.dueDates.remove(row);
  }
}

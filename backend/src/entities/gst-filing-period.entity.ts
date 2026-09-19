import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PeriodSchedule } from '../common/types/gst-schedule';

@Entity('gst_filing_periods')
export class GstFilingPeriod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  period_label: string;

  @Index()
  @Column({ type: 'varchar', length: 7, unique: true })
  period_code: string;

  @Column({ type: 'date' })
  due_date: string;

  @Column({ type: 'boolean', default: true })
  is_open: boolean;

  /** Per-category deadlines + reminder dates. Nullable (default computed by SchedulingService). */
  @Column({ type: 'jsonb', nullable: true })
  schedule: PeriodSchedule | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

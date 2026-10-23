import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** One statutory deadline in the client app's due date calendar. */
@Entity('due_dates')
@Index(['fy', 'due_date'])
export class DueDate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  /** Form / return code, e.g. "GSTR-3B" or "138 / 140". */
  @Column({ type: 'varchar', length: 60, nullable: true })
  form: string | null;

  /** gst | income_tax | tds */
  @Column({ type: 'varchar', length: 20 })
  category: string;

  @Column({ type: 'date' })
  due_date: string;

  /** Set when the deadline was extended: the date before the extension. */
  @Column({ type: 'date', nullable: true })
  original_due_date: string | null;

  /** Return period the deadline is for, e.g. "October 2026" or "AY 2026-27". */
  @Column({ type: 'varchar', length: 60, nullable: true })
  period_label: string | null;

  @Column({ type: 'text', default: '' })
  description: string;

  /** Who it applies to (see DUE_DATE_AUDIENCES); drives "relevant to me". */
  @Column({ type: 'jsonb', default: () => '\'["all"]\'' })
  audiences: string[];

  /** Financial year the calendar belongs to, e.g. "2026-27". */
  @Column({ type: 'varchar', length: 9 })
  fy: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

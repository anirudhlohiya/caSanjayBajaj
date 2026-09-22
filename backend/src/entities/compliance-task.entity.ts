import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ComplianceCategory, TaskStatus } from '../common/enums';
import { GstFilingPeriod } from './gst-filing-period.entity';
import { User } from './user.entity';

@Entity('compliance_tasks')
@Index(['user_id', 'filing_period_id'])
export class ComplianceTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid' })
  filing_period_id: string;

  @Column({ type: 'enum', enum: ComplianceCategory })
  category: ComplianceCategory;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.PENDING,
  })
  status: TaskStatus;

  @Column({ type: 'timestamptz', nullable: true })
  nil_declared_at: Date | null;

  /** Reminder-slot marker (0/1/2) used to dedupe auto-reminders per day (docs/13 §6.1). */
  @Column({ type: 'int', nullable: true })
  message_day: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  due_date: Date | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  amount: string | null; // e.g. for GST Payment

  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date | null;

  /** Set when the CA marks the return as filed (GSTR-1 / IFF / GSTR-3B). */
  @Column({ type: 'timestamptz', nullable: true })
  filed_at: Date | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  arn: string | null;

  /** Optional filed-return PDF, uploaded through the reports flow. */
  @Column({ type: 'uuid', nullable: true })
  filed_report_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  filed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  payment_reminder_sent_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => GstFilingPeriod)
  @JoinColumn({ name: 'filing_period_id' })
  filing_period: GstFilingPeriod;
}

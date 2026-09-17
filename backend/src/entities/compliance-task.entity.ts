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
  due_date: Date | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  amount: string | null; // e.g. for GST Payment

  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date | null;

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

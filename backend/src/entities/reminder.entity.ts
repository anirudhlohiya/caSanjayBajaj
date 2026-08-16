import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReminderChannel, ReminderStatus } from '../common/enums';
import { GstFilingPeriod } from './gst-filing-period.entity';
import { User } from './user.entity';

@Entity('reminders')
export class Reminder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Index()
  @Column({ type: 'uuid' })
  filing_period_id: string;

  @Column({ type: 'enum', enum: ReminderChannel })
  channel: ReminderChannel;

  @Column({
    type: 'enum',
    enum: ReminderStatus,
    default: ReminderStatus.QUEUED,
  })
  status: ReminderStatus;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'varchar', length: 40 })
  triggered_by: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => GstFilingPeriod)
  @JoinColumn({ name: 'filing_period_id' })
  filing_period: GstFilingPeriod;
}

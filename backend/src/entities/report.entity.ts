import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReportType } from '../common/enums';
import { Admin } from './admin.entity';
import { GstFilingPeriod } from './gst-filing-period.entity';
import { User } from './user.entity';

@Entity('reports')
@Index(['user_id', 'filing_period_id'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid' })
  filing_period_id: string;

  @Column({ type: 'enum', enum: ReportType })
  report_type: ReportType;

  @Column({ type: 'varchar', length: 500 })
  s3_key: string;

  @Column({ type: 'varchar', length: 255 })
  original_filename: string;

  @Column({ type: 'uuid', nullable: true })
  sent_by_admin_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  sent_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => GstFilingPeriod)
  @JoinColumn({ name: 'filing_period_id' })
  filing_period: GstFilingPeriod;

  @ManyToOne(() => Admin, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sent_by_admin_id' })
  sent_by_admin: Admin | null;
}

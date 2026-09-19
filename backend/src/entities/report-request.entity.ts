import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReportRequestStatus } from '../common/enums';
import { GstFilingPeriod } from './gst-filing-period.entity';
import { Report } from './report.entity';
import { User } from './user.entity';

@Entity('report_requests')
export class ReportRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Index()
  @Column({ type: 'uuid' })
  filing_period_id: string;

  @Index()
  @Column({ type: 'enum', enum: ReportRequestStatus })
  status: ReportRequestStatus;

  @Column({ type: 'uuid', nullable: true })
  fulfilled_report_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  fulfilled_at: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => GstFilingPeriod)
  @JoinColumn({ name: 'filing_period_id' })
  filing_period: GstFilingPeriod;

  @ManyToOne(() => Report, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'fulfilled_report_id' })
  fulfilled_report: Report | null;
}

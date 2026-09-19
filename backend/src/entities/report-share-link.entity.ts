import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Report } from './report.entity';

@Entity('report_share_links')
export class ReportShareLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  report_id: string;

  /** sha256(token) — the raw token is only ever issued to the recipient. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  token_hash: string;

  @Index()
  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Report, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report: Report;
}

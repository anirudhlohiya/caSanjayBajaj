import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Admin } from './admin.entity';
import { GstFilingPeriod } from './gst-filing-period.entity';
import { User } from './user.entity';

@Entity('audit_logs')
@Index(['admin_id', 'created_at'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  admin_id: string | null;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'uuid', nullable: true })
  target_user_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  target_period_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  detail: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Admin, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'admin_id' })
  admin: Admin | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'target_user_id' })
  target_user: User | null;

  @ManyToOne(() => GstFilingPeriod, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'target_period_id' })
  target_period: GstFilingPeriod | null;
}

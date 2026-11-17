import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AdminRole, AdminStatus } from '../common/enums';

@Entity('admins')
export class Admin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Index()
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password_hash: string;

  @Column({ type: 'enum', enum: AdminRole, default: AdminRole.STAFF })
  role: AdminRole;

  @Column({ type: 'enum', enum: AdminStatus, default: AdminStatus.ACTIVE })
  status: AdminStatus;

  /** Access tokens issued before this moment are refused (JwtAuthGuard). */
  @Column({ type: 'timestamptz', nullable: true })
  sessions_valid_from: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

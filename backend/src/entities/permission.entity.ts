import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Admin } from './admin.entity';

@Entity('permissions')
@Unique(['admin_id', 'permission_key'])
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  admin_id: string;

  @Column({ type: 'varchar', length: 50 })
  permission_key: string;

  @Column({ type: 'boolean', default: false })
  granted: boolean;

  @ManyToOne(() => Admin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admin_id' })
  admin: Admin;
}

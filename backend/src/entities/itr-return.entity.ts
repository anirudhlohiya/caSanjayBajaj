import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Admin } from './admin.entity';

@Entity('itr_returns')
@Unique(['user_id', 'assessment_year'])
export class ItrReturn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 20 })
  assessment_year: string;

  @Column({ type: 'varchar', length: 500 })
  s3_key: string;

  @Column({ type: 'varchar', length: 255 })
  original_filename: string;

  @Column({ type: 'bigint' })
  file_size_bytes: string;

  @Column({ type: 'uuid', nullable: true })
  uploaded_by: string | null;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  uploaded_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Admin, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'uploaded_by' })
  uploader: Admin | null;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DocumentFileType, DocumentStatus } from '../common/enums';
import { GstFilingPeriod } from './gst-filing-period.entity';
import { User } from './user.entity';

@Entity('documents')
@Index(['user_id', 'filing_period_id'])
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid' })
  filing_period_id: string;

  @Column({ type: 'varchar', length: 500 })
  s3_key: string;

  @Column({ type: 'varchar', length: 255 })
  original_filename: string;

  @Column({ type: 'enum', enum: DocumentFileType })
  file_type: DocumentFileType;

  @Column({ type: 'bigint' })
  file_size_bytes: string;

  @Index()
  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.PENDING,
  })
  status: DocumentStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  uploaded_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  processed_at: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => GstFilingPeriod)
  @JoinColumn({ name: 'filing_period_id' })
  filing_period: GstFilingPeriod;
}

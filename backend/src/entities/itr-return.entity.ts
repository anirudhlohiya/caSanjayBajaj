import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Admin } from './admin.entity';
import { FamilyMember } from './family-member.entity';

// One return per person per AY: unique on (user_id, family_member_id, assessment_year),
// enforced by an expression index in migration 1800000000006.
@Entity('itr_returns')
export class ItrReturn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  /** Null = the account holder; otherwise the family member it is for. */
  @Column({ type: 'uuid', nullable: true })
  family_member_id: string | null;

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

  @ManyToOne(() => FamilyMember, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'family_member_id' })
  family_member: FamilyMember | null;

  @ManyToOne(() => Admin, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'uploaded_by' })
  uploader: Admin | null;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GstFilingFrequency, UserStatus, UserType } from '../common/enums';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Index()
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password_hash: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 15, unique: true, nullable: true })
  gstin: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  business_name: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  industry: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pan: string | null;

  @Column({ type: 'date', nullable: true })
  dob: Date | string | null;

  @Column({ type: 'enum', enum: UserType, default: UserType.GENERAL })
  user_type: UserType;

  @Column({ type: 'text', nullable: true })
  profile_photo_url: string | null;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({
    type: 'enum',
    enum: GstFilingFrequency,
    default: GstFilingFrequency.MONTHLY,
  })
  gst_filing_frequency: GstFilingFrequency;

  @Column({ type: 'timestamptz', nullable: true })
  email_suppressed_at: Date | null;

  /** Client asked to delete the account; erased 30 days later unless they sign in. */
  @Column({ type: 'timestamptz', nullable: true })
  deletion_requested_at: Date | null;

  /** Login and personal details erased; tax records kept for the firm. */
  @Column({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

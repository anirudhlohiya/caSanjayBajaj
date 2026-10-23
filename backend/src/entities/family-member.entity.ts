import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * A family member whose income tax returns the account holder manages
 * (spouse, parents, children…). Up to MAX_FAMILY_MEMBERS per account.
 */
@Entity('family_members')
export class FamilyMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The account holder. */
  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** spouse | son | daughter | father | mother | brother | sister | other */
  @Column({ type: 'varchar', length: 20 })
  relation: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pan: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

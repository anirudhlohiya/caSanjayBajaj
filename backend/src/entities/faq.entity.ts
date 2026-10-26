import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** One question on the client app's FAQ page, managed in the admin panel. */
@Entity('faqs')
export class Faq {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** gst | itr | documents | app | general */
  @Column({ type: 'varchar', length: 20 })
  category: string;

  @Column({ type: 'varchar', length: 300 })
  question: string;

  /** Answer in markdown. */
  @Column({ type: 'text' })
  answer_md: string;

  @Column({ type: 'int', default: 0 })
  display_order: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

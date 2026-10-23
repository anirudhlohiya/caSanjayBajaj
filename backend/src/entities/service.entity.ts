import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** URL key used by the client app, e.g. 'gst' → /services/gst. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  /** Short summary shown on the service card. */
  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tags: string[];

  /** Full detail page, markdown. */
  @Column({ type: 'text', default: '' })
  body_md: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  price: string | null;

  /** Material Symbols icon name. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string | null;

  /** Palette key for the icon tile (blue, green, …). */
  @Column({ type: 'varchar', length: 20, nullable: true })
  icon_color: string | null;

  /** Overrides the firm-wide number for the Call / WhatsApp buttons. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  contact_phone: string | null;

  @Column({ type: 'int', default: 0 })
  display_order: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

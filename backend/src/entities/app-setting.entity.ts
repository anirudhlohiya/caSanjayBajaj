import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Small key/value store for firm-wide settings edited in the admin panel. */
@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

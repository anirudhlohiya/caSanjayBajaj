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
import { Admin } from './admin.entity';

export enum RentAgreementStatus {
  DRAFT = 'draft',
  GENERATED = 'generated',
}

@Entity('rent_agreements')
export class RentAgreement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  template_id: string;

  @Column({ type: 'int', default: 1 })
  template_version: number;

  @Column({
    type: 'enum',
    enum: RentAgreementStatus,
    default: RentAgreementStatus.DRAFT,
  })
  status: RentAgreementStatus;

  @Index()
  @Column({ type: 'varchar', length: 255, nullable: true })
  owner_name: string | null;

  @Index()
  @Column({ type: 'varchar', length: 255, nullable: true })
  tenant_name: string | null;

  @Index()
  @Column({ type: 'varchar', length: 500, nullable: true })
  property_address: string | null;

  @Column({ type: 'date', nullable: true })
  agreement_start_date: string | null;

  @Column({ type: 'date', nullable: true })
  agreement_end_date: string | null;

  @Column({ type: 'jsonb', default: {} })
  form_data: any;

  @Column({ type: 'varchar', length: 500, nullable: true })
  edited_docx_s3_key: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by_admin_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Admin, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_admin_id' })
  created_by_admin: Admin | null;
}

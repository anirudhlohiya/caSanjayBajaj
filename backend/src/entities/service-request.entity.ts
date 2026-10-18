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
import { ServiceRequestStatus, ServiceRequestType } from '../common/enums';
import { User } from './user.entity';
import { Admin } from './admin.entity';

export interface ServiceRequestPayload {
  business_name?: string;
  gstin?: string;
  filing_frequency?: string;
  industry?: string;
  pan?: string;
}

@Entity('service_requests')
export class ServiceRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({
    type: 'enum',
    enum: ServiceRequestType,
  })
  requested_type: ServiceRequestType;

  @Index()
  @Column({
    type: 'enum',
    enum: ServiceRequestStatus,
    default: ServiceRequestStatus.PENDING,
  })
  status: ServiceRequestStatus;

  @Column({ type: 'jsonb', default: {} })
  payload: ServiceRequestPayload;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Admin, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: Admin | null;
}

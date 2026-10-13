import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WhatsappMessage } from './whatsapp-message.entity';
import { User } from './user.entity';

export type WhatsappConversationStatus =
  'ai_handling' | 'staff_takeover' | 'escalated' | 'closed';

@Entity('whatsapp_conversations')
export class WhatsappConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32, name: 'phone_number' })
  phoneNumber: string;

  @Column({ type: 'varchar', length: 150, nullable: true, name: 'client_name' })
  clientName: string | null;

  @Column({
    type: 'varchar',
    length: 200,
    nullable: true,
    name: 'business_name',
  })
  businessName: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gstin: string | null;

  @Column({ type: 'boolean', default: false })
  verified: boolean;

  @Column({ type: 'uuid', nullable: true, name: 'client_id' })
  clientId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'client_id' })
  client?: User | null;

  @Column({
    type: 'enum',
    enum: ['ai_handling', 'staff_takeover', 'escalated', 'closed'],
    default: 'ai_handling',
  })
  status: WhatsappConversationStatus;

  @Column({ type: 'uuid', nullable: true, name: 'assigned_staff_id' })
  assignedStaffId: string | null;

  @Column({ type: 'text', nullable: true, name: 'internal_notes' })
  internalNotes: string | null;

  @Column({ type: 'int', default: 0, name: 'unread_count' })
  unreadCount: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_message_at' })
  lastMessageAt: Date | null;

  @OneToMany(() => WhatsappMessage, (m) => m.conversation)
  messages: WhatsappMessage[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { WhatsappConversation } from './whatsapp-conversation.entity';

export type WhatsappDirection = 'inbound' | 'outbound';
export type WhatsappSender = 'client' | 'ai' | 'staff';
export type WhatsappMessageType =
  'text' | 'image' | 'document' | 'audio' | 'template' | 'interactive';

@Entity('whatsapp_messages')
export class WhatsappMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true, where: 'meta_message_id IS NOT NULL' })
  @Column({
    type: 'varchar',
    length: 150,
    nullable: true,
    name: 'meta_message_id',
  })
  metaMessageId: string | null;

  @ManyToOne(() => WhatsappConversation, (c) => c.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: WhatsappConversation;

  @Index()
  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId: string;

  @Column({ type: 'enum', enum: ['inbound', 'outbound'] })
  direction: WhatsappDirection;

  @Column({ type: 'enum', enum: ['client', 'ai', 'staff'] })
  sender: WhatsappSender;

  @Column({
    type: 'enum',
    enum: ['text', 'image', 'document', 'audio', 'template', 'interactive'],
    default: 'text',
    name: 'message_type',
  })
  messageType: WhatsappMessageType;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true, name: 'media_url' })
  mediaUrl: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'template_name',
  })
  templateName: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'staff_id' })
  staffId: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TicketMessage } from './ticket-message.entity';

@Entity('ticket_attachments')
export class TicketAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ticket_message_id: string;

  @ManyToOne(() => TicketMessage, (msg) => msg.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ticket_message_id' })
  ticket_message: TicketMessage;

  @Column({ type: 'varchar', length: 500 })
  s3_key: string;

  @Column({ type: 'varchar', length: 255 })
  original_filename: string;

  @Column({ type: 'bigint' })
  file_size_bytes: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Ticket } from './ticket.entity';
import { TicketAttachment } from './ticket-attachment.entity';

@Entity('ticket_messages')
export class TicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ticket_id: string;

  @ManyToOne(() => Ticket, (ticket) => ticket.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @Column({ type: 'enum', enum: ['user', 'admin'] })
  sender_type: 'user' | 'admin';

  @Column({ type: 'varchar', length: 36 })
  sender_id: string;

  @Column({ type: 'text' })
  message: string;

  @OneToMany(() => TicketAttachment, (att) => att.ticket_message, {
    cascade: true,
  })
  attachments: TicketAttachment[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

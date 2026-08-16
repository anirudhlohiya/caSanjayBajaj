import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { DevicePlatform } from '../common/enums';
import { User } from './user.entity';

@Entity('device_tokens')
@Unique(['user_id', 'push_token'])
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'enum', enum: DevicePlatform, default: DevicePlatform.PWA })
  platform: DevicePlatform;

  @Column({ type: 'varchar', length: 500 })
  push_token: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

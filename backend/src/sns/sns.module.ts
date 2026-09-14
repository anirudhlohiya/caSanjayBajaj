import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';
import { SnsController } from './sns.controller';
import { SnsService } from './sns.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, AuditLog])],
  controllers: [SnsController],
  providers: [SnsService],
})
export class SnsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DueDate } from '../entities/due-date.entity';
import {
  AdminDueDatesController,
  DueDatesController,
} from './due-dates.controller';
import { DueDatesService } from './due-dates.service';

@Module({
  imports: [TypeOrmModule.forFeature([DueDate])],
  controllers: [DueDatesController, AdminDueDatesController],
  providers: [DueDatesService],
})
export class DueDatesModule {}

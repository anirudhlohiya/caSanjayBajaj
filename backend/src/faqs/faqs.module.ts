import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Faq } from '../entities/faq.entity';
import { AdminFaqsController, FaqsController } from './faqs.controller';
import { FaqsService } from './faqs.service';

@Module({
  imports: [TypeOrmModule.forFeature([Faq])],
  controllers: [FaqsController, AdminFaqsController],
  providers: [FaqsService],
})
export class FaqsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RentAgreement } from '../entities/rent-agreement.entity';
import { StorageModule } from '../storage/storage.module';
import { RentAgreementsController } from './rent-agreements.controller';
import { RentAgreementsOfficeController } from './rent-agreements-office.controller';
import { RentAgreementsService } from './rent-agreements.service';
import { LibreOfficeService } from './libreoffice.service';

@Module({
  imports: [TypeOrmModule.forFeature([RentAgreement]), StorageModule],
  controllers: [RentAgreementsController, RentAgreementsOfficeController],
  providers: [RentAgreementsService, LibreOfficeService],
})
export class RentAgreementsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from '../entities/report.entity';
import { ReportShareLink } from '../entities/report-share-link.entity';
import { StorageModule } from '../storage/storage.module';
import { ShareLinksController } from './share-links.controller';
import { ShareLinksService } from './share-links.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReportShareLink, Report]), StorageModule],
  controllers: [ShareLinksController],
  providers: [ShareLinksService],
  exports: [ShareLinksService],
})
export class ShareLinksModule {}

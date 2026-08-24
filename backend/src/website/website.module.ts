import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { BlogPost } from '../entities/blog-post.entity';
import { Lead } from '../entities/lead.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebsiteAdminController } from './website-admin.controller';
import { WebsitePublicController } from './website-public.controller';
import { WebsiteService } from './website.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BlogPost, Lead]),
    AuditModule,
    NotificationsModule,
  ],
  controllers: [WebsiteAdminController, WebsitePublicController],
  providers: [WebsiteService],
  exports: [WebsiteService],
})
export class WebsiteModule {}

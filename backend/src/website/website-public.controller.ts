import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CreateLeadDto, PublicBlogQueryDto } from './dto/website.dto';
import { WebsiteService } from './website.service';

const LEAD_SUBMITS = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('website')
@Controller('website')
export class WebsitePublicController {
  constructor(private readonly websiteService: WebsiteService) {}

  @Get('blog-posts')
  @ApiOperation({
    summary: 'Published blog posts (public, consumed by site build)',
  })
  list(@Query() query: PublicBlogQueryDto) {
    return this.websiteService.publicList(query);
  }

  @Get('blog-posts/:slug')
  @ApiOperation({
    summary: 'A published post by slug, markdown rendered to HTML',
  })
  bySlug(@Param('slug') slug: string) {
    return this.websiteService.publicBySlug(slug);
  }

  @Post('leads')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(LEAD_SUBMITS)
  @ApiOperation({
    summary: 'Website enquiry form submission (rate-limited, spam-safe)',
  })
  createLead(@Req() req: Request, @Body() dto: CreateLeadDto) {
    return this.websiteService.createLead(dto, req.ip ?? null);
  }
}

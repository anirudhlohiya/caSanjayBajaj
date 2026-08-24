import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard, RolesGuard } from '../common/guards/roles.guard';
import { PostStatus } from '../common/enums';
import {
  BlogPostQueryDto,
  CreateBlogPostDto,
  LeadQueryDto,
  UpdateBlogPostDto,
  UpdateLeadStatusDto,
} from './dto/website.dto';
import { WebsiteService } from './website.service';

@ApiTags('website')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Permissions('manage_website')
@Controller('admin/website')
export class WebsiteAdminController {
  constructor(private readonly websiteService: WebsiteService) {}

  // ----- Blogs -----

  @Get('blog-posts')
  @ApiOperation({ summary: 'List blog posts (all statuses)' })
  listPosts(@Query() query: BlogPostQueryDto) {
    return this.websiteService.adminListPosts(query);
  }

  @Get('blog-posts/:id')
  @ApiOperation({ summary: 'Get a single blog post (any status)' })
  getPost(@Param('id', ParseUUIDPipe) id: string) {
    return this.websiteService.adminGetPost(id);
  }

  @Post('blog-posts')
  @ApiOperation({ summary: 'Create a draft blog post' })
  createPost(@CurrentUser() auth: AuthUser, @Body() dto: CreateBlogPostDto) {
    return this.websiteService.createPost(auth, dto);
  }

  @Patch('blog-posts/:id')
  @ApiOperation({ summary: 'Update title/slug/excerpt/content of a post' })
  updatePost(
    @CurrentUser() auth: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBlogPostDto,
  ) {
    return this.websiteService.updatePost(auth, id, dto);
  }

  @Post('blog-posts/:id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a post (triggers site rebuild)' })
  publishPost(
    @CurrentUser() auth: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.websiteService.setPostStatus(auth, id, PostStatus.PUBLISHED);
  }

  @Post('blog-posts/:id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Move a post back to draft (triggers site rebuild)',
  })
  unpublishPost(
    @CurrentUser() auth: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.websiteService.setPostStatus(auth, id, PostStatus.DRAFT);
  }

  @Delete('blog-posts/:id')
  @ApiOperation({
    summary: 'Delete a post permanently (triggers site rebuild if live)',
  })
  deletePost(
    @CurrentUser() auth: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.websiteService.deletePost(auth, id);
  }

  // ----- Leads -----

  @Get('leads')
  @ApiOperation({ summary: 'List website enquiries' })
  listLeads(@Query() query: LeadQueryDto) {
    return this.websiteService.adminListLeads(query);
  }

  @Patch('leads/:id/status')
  @ApiOperation({ summary: 'Mark lead contacted/closed/new' })
  updateLeadStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    return this.websiteService.updateLeadStatus(id, dto);
  }
}

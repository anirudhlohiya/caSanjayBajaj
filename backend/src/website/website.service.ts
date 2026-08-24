import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { marked } from 'marked';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { paginate, PaginatedResult } from '../common/dto/pagination';
import { PostStatus } from '../common/enums';
import { BlogPost } from '../entities/blog-post.entity';
import { Lead } from '../entities/lead.entity';
import { NotificationsService } from '../notifications/notifications.service';
import {
  BlogPostQueryDto,
  CreateBlogPostDto,
  CreateLeadDto,
  LeadQueryDto,
  PublicBlogQueryDto,
  UpdateBlogPostDto,
  UpdateLeadStatusDto,
} from './dto/website.dto';

export interface PublicBlogListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: Date | null;
}

export interface PublicBlogPost extends PublicBlogListItem {
  content_html: string;
  updated_at: Date;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

@Injectable()
export class WebsiteService {
  private readonly logger = new Logger(WebsiteService.name);

  constructor(
    @InjectRepository(BlogPost)
    private readonly posts: Repository<BlogPost>,
    @InjectRepository(Lead)
    private readonly leads: Repository<Lead>,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  // ---------- Admin: blog posts ----------

  async adminListPosts(
    query: BlogPostQueryDto,
  ): Promise<PaginatedResult<BlogPost>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const qb = this.posts
      .createQueryBuilder('post')
      .orderBy('post.updated_at', 'DESC');
    if (query.status)
      qb.andWhere('post.status = :status', { status: query.status });
    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return paginate(items, total, page, pageSize);
  }

  async adminGetPost(id: string): Promise<BlogPost> {
    const post = await this.posts.findOneBy({ id });
    if (!post) throw new NotFoundException('Blog post not found');
    return post;
  }

  async createPost(auth: AuthUser, dto: CreateBlogPostDto): Promise<BlogPost> {
    const slug = await this.uniqueSlug(dto.slug || slugify(dto.title));
    const post = await this.posts.save(
      this.posts.create({
        title: dto.title.trim(),
        slug,
        excerpt: dto.excerpt?.trim() || null,
        content_md: dto.content_md,
        created_by_admin_id: auth.sub,
      }),
    );
    await this.audit.log(auth.sub, 'blog_post.create', {
      post_id: post.id,
      slug,
    });
    return post;
  }

  async updatePost(
    auth: AuthUser,
    id: string,
    dto: UpdateBlogPostDto,
  ): Promise<BlogPost> {
    const post = await this.adminGetPost(id);
    if (dto.slug && dto.slug !== post.slug) {
      post.slug = await this.uniqueSlug(dto.slug);
    }
    if (dto.title !== undefined) post.title = dto.title.trim();
    if (dto.excerpt !== undefined) post.excerpt = dto.excerpt.trim() || null;
    if (dto.content_md !== undefined) post.content_md = dto.content_md;
    const saved = await this.posts.save(post);
    // Content of a live post changed — rebuild the public site
    if (saved.status === PostStatus.PUBLISHED) void this.triggerDeployHook();
    await this.audit.log(auth.sub, 'blog_post.update', { post_id: saved.id });
    return saved;
  }

  async setPostStatus(
    auth: AuthUser,
    id: string,
    status: PostStatus,
  ): Promise<BlogPost> {
    const post = await this.adminGetPost(id);
    if (post.status === status) return post;
    post.status = status;
    post.published_at =
      status === PostStatus.PUBLISHED ? new Date() : post.published_at;
    const saved = await this.posts.save(post);
    void this.triggerDeployHook();
    await this.audit.log(auth.sub, `blog_post.${status}`, {
      post_id: saved.id,
      slug: saved.slug,
    });
    return saved;
  }

  async deletePost(auth: AuthUser, id: string): Promise<{ success: boolean }> {
    const post = await this.adminGetPost(id);
    const wasPublished = post.status === PostStatus.PUBLISHED;
    await this.posts.remove(post);
    if (wasPublished) void this.triggerDeployHook();
    await this.audit.log(auth.sub, 'blog_post.delete', {
      post_id: id,
      slug: post.slug,
    });
    return { success: true };
  }

  // ---------- Public (used by Astro build) ----------

  async publicList(
    query: PublicBlogQueryDto,
  ): Promise<PaginatedResult<PublicBlogListItem>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const [items, total] = await this.posts
      .createQueryBuilder('post')
      .select([
        'post.id',
        'post.title',
        'post.slug',
        'post.excerpt',
        'post.published_at',
      ])
      .where('post.status = :status', { status: PostStatus.PUBLISHED })
      .orderBy('post.published_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return paginate(items as PublicBlogListItem[], total, page, pageSize);
  }

  async publicBySlug(slug: string): Promise<PublicBlogPost> {
    const post = await this.posts.findOneBy({
      slug,
      status: PostStatus.PUBLISHED,
    });
    if (!post) throw new NotFoundException('Blog post not found');
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      published_at: post.published_at,
      updated_at: post.updated_at,
      content_html: await marked.parse(post.content_md),
    };
  }

  // ---------- Leads ----------

  async createLead(
    dto: CreateLeadDto,
    ip: string | null,
  ): Promise<{ success: boolean }> {
    const lead = await this.leads.save(
      this.leads.create({
        full_name: dto.full_name.trim(),
        email: dto.email.toLowerCase().trim(),
        phone: dto.phone.trim(),
        query_type: dto.query_type?.trim() || null,
        message: dto.message.trim(),
        source_ip: ip,
      }),
    );
    void this.notifyFirm(lead).catch((error: Error) =>
      this.logger.warn(`Lead notification email failed: ${error.message}`),
    );
    return { success: true };
  }

  private async notifyFirm(lead: Lead): Promise<void> {
    const to = this.config.get<string>('website.leadNotifyEmail');
    if (!to) return;
    const rows: Array<[string, string]> = [
      ['Name', lead.full_name],
      ['Email', lead.email],
      ['Phone', lead.phone],
      ['Service', lead.query_type ?? '—'],
      ['Message', lead.message.replace(/\n/g, '<br/>')],
    ];
    const html = `<p>New enquiry from <strong>snbajaj.com</strong>:</p>
      <table cellpadding="6" style="border-collapse:collapse">${rows
        .map(
          ([k, v]) =>
            `<tr><td style="font-weight:600">${k}</td><td>${v}</td></tr>`,
        )
        .join('')}</table>`;
    await this.notifications.sendEmail(
      { email: to },
      `New website enquiry — ${lead.full_name}`,
      html,
    );
  }

  async adminListLeads(query: LeadQueryDto): Promise<PaginatedResult<Lead>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const qb = this.leads
      .createQueryBuilder('lead')
      .orderBy('lead.created_at', 'DESC');
    if (query.status)
      qb.andWhere('lead.status = :status', { status: query.status });
    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return paginate(items, total, page, pageSize);
  }

  async updateLeadStatus(id: string, dto: UpdateLeadStatusDto): Promise<Lead> {
    const lead = await this.leads.findOneBy({ id });
    if (!lead) throw new NotFoundException('Lead not found');
    lead.status = dto.status;
    return this.leads.save(lead);
  }

  // ---------- Helpers ----------

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base || `post-${Date.now()}`;
    let suffix = 2;
    while (await this.posts.exists({ where: { slug } })) {
      slug = `${base}-${suffix++}`;
    }
    return slug;
  }

  /** Ask Cloudflare Pages to rebuild the marketing site (no-op if unset). */
  private async triggerDeployHook(): Promise<void> {
    const url = this.config.get<string>('website.deployHookUrl');
    if (!url) return;
    try {
      const res = await fetch(url, { method: 'POST' });
      this.logger.log(`Cloudflare deploy hook fired: HTTP ${res.status}`);
    } catch (error) {
      this.logger.warn(
        `Cloudflare deploy hook failed: ${(error as Error).message}`,
      );
    }
  }
}

import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import {
  WebsiteService,
} from '../../core/services/feature.services';
import { ToastService } from '../../core/services/toast.service';
import { BlogPost, Lead } from '../../core/models';
import { PageHeader } from '../../shared/components/page-header';
import { StatusChip } from '../../shared/components/status-chip';
import { Pagination } from '../../shared/components/pagination';
import { Spinner } from '../../shared/components/spinner';
import { EmptyState } from '../../shared/components/empty-state';

@Component({
  selector: 'app-website',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, PageHeader, StatusChip, Pagination, Spinner, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './website.html',
})
export class Website implements OnInit {
  private readonly websiteService = inject(WebsiteService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly tab = signal<'blogs' | 'leads'>('blogs');

  // ----- Blogs state -----
  readonly postsLoading = signal(true);
  readonly posts = signal<BlogPost[]>([]);
  readonly postPage = signal(1);
  readonly postPageSize = signal(20);
  readonly postTotal = signal(0);
  readonly postTotalPages = signal(0);
  readonly postStatusFilter = signal('');
  readonly savingPost = signal(false);
  readonly busyPostId = signal('');

  readonly editorOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly slugTouched = signal(false);

  readonly postForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    slug: [''],
    excerpt: [''],
    content_md: ['', Validators.required],
  });

  // ----- Leads state -----
  readonly leadsLoading = signal(true);
  readonly leads = signal<Lead[]>([]);
  readonly leadPage = signal(1);
  readonly leadPageSize = signal(20);
  readonly leadTotal = signal(0);
  readonly leadTotalPages = signal(0);
  readonly leadStatusFilter = signal('');
  readonly busyLeadId = signal('');
  readonly expandedLeadId = signal('');

  ngOnInit(): void {
    void this.loadPosts();
    void this.loadLeads();
  }

  switchTab(tab: 'blogs' | 'leads'): void {
    this.tab.set(tab);
  }

  // ----- Blogs -----

  async loadPosts(): Promise<void> {
    this.postsLoading.set(true);
    try {
      const res = await this.websiteService.listPosts({
        page: this.postPage(),
        pageSize: this.postPageSize(),
        status: this.postStatusFilter() || undefined,
      });
      this.posts.set(res.items);
      this.postTotal.set(res.total);
      this.postTotalPages.set(res.totalPages);
    } finally {
      this.postsLoading.set(false);
    }
  }

  filterPosts(): void {
    this.postPage.set(1);
    void this.loadPosts();
  }

  postPageChanged(p: number): void {
    this.postPage.set(p);
    void this.loadPosts();
  }

  openNewPost(): void {
    this.editingId.set(null);
    this.slugTouched.set(false);
    this.postForm.reset({ title: '', slug: '', excerpt: '', content_md: '' });
    this.editorOpen.set(true);
  }

  openEditPost(post: BlogPost): void {
    this.editingId.set(post.id);
    this.slugTouched.set(true);
    this.postForm.reset({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt ?? '',
      content_md: post.content_md,
    });
    this.editorOpen.set(true);
  }

  closeEditor(): void {
    if (this.savingPost()) return;
    this.editorOpen.set(false);
  }

  onTitleInput(): void {
    if (!this.editingId() && !this.slugTouched()) {
      const slug = this.postForm.controls.title.value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      this.postForm.controls.slug.setValue(slug);
    }
  }

  async savePost(): Promise<void> {
    const f = this.postForm;
    if (f.invalid) {
      f.markAllAsTouched();
      this.toast.error('Title and content are required');
      return;
    }
    this.savingPost.set(true);
    try {
      const body = {
        title: f.controls.title.value.trim(),
        slug: f.controls.slug.value.trim() || undefined,
        excerpt: f.controls.excerpt.value.trim() || undefined,
        content_md: f.controls.content_md.value,
      };
      if (this.editingId()) {
        await this.websiteService.updatePost(this.editingId()!, body);
        this.toast.success('Post updated');
      } else {
        await this.websiteService.createPost(body);
        this.toast.success('Draft created');
      }
      this.editorOpen.set(false);
      await this.loadPosts();
    } finally {
      this.savingPost.set(false);
    }
  }

  async publish(post: BlogPost): Promise<void> {
    this.busyPostId.set(post.id);
    try {
      await this.websiteService.publishPost(post.id);
      this.toast.success(
        `Published. The public site rebuilds automatically in ~30 seconds.`,
      );
      await this.loadPosts();
    } finally {
      this.busyPostId.set('');
    }
  }

  async unpublish(post: BlogPost): Promise<void> {
    this.busyPostId.set(post.id);
    try {
      await this.websiteService.unpublishPost(post.id);
      this.toast.success('Moved back to draft');
      await this.loadPosts();
    } finally {
      this.busyPostId.set('');
    }
  }

  async deletePost(post: BlogPost): Promise<void> {
    this.busyPostId.set(post.id);
    try {
      await this.websiteService.deletePost(post.id);
      this.toast.success('Post deleted');
      await this.loadPosts();
    } finally {
      this.busyPostId.set('');
    }
  }

  // ----- Leads -----

  async loadLeads(): Promise<void> {
    this.leadsLoading.set(true);
    try {
      const res = await this.websiteService.listLeads({
        page: this.leadPage(),
        pageSize: this.leadPageSize(),
        status: this.leadStatusFilter() || undefined,
      });
      this.leads.set(res.items);
      this.leadTotal.set(res.total);
      this.leadTotalPages.set(res.totalPages);
    } finally {
      this.leadsLoading.set(false);
    }
  }

  filterLeads(): void {
    this.leadPage.set(1);
    void this.loadLeads();
  }

  leadPageChanged(p: number): void {
    this.leadPage.set(p);
    void this.loadLeads();
  }

  async setLeadStatus(lead: Lead, status: string): Promise<void> {
    this.busyLeadId.set(lead.id);
    try {
      await this.websiteService.setLeadStatus(lead.id, status);
      this.toast.success(`Enquiry marked ${status}`);
      await this.loadLeads();
    } finally {
      this.busyLeadId.set('');
    }
  }

  toggleExpand(id: string): void {
    this.expandedLeadId.update((cur) => (cur === id ? '' : id));
  }

  fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

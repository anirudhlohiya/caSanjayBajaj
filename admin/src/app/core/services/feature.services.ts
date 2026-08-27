import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from './api-client.service';
import type {
  AuditLog,
  BlogPost,
  Client,
  DashboardStats,
  Document,
  FilingPeriod,
  Lead,
  PaginatedResult,
  Permission,
  Reminder,
  Report,
  ReportUploadUrl,
  SendReminderResult,
  Service,
  Ticket,
  TicketMessage,
  UploadUrl,
  Admin,
} from '../models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiClient);

  me() {
    return firstValueFrom(this.api.get<Admin>('/admin/me'));
  }

  stats() {
    return firstValueFrom(this.api.get<DashboardStats>('/admin/dashboard/stats'));
  }
}

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly api = inject(ApiClient);

  list(page = 1, pageSize = 20) {
    return firstValueFrom(
      this.api.get<PaginatedResult<Client>>('/admin/users', { page, pageSize }),
    );
  }

  get(id: string) {
    return firstValueFrom(this.api.get<Client>(`/admin/users/${id}`));
  }

  create(body: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    gstin?: string;
    user_type?: string;
    status?: string;
  }) {
    return firstValueFrom(this.api.post<Client>('/admin/users', body));
  }

  update(
    id: string,
    body: { name?: string; phone?: string; gstin?: string; status?: string },
  ) {
    return firstValueFrom(this.api.patch<Client>(`/admin/users/${id}`, body));
  }

  deactivate(id: string) {
    return firstValueFrom(this.api.delete<{ success: boolean }>(`/admin/users/${id}`));
  }
}

@Injectable({ providedIn: 'root' })
export class PeriodsService {
  private readonly api = inject(ApiClient);

  list() {
    return firstValueFrom(this.api.get<FilingPeriod[]>('/periods'));
  }

  open() {
    return firstValueFrom(this.api.get<FilingPeriod[]>('/periods/open'));
  }

  create(body: { period_label: string; period_code: string; due_date: string; is_open?: boolean }) {
    return firstValueFrom(this.api.post<FilingPeriod>('/periods', body));
  }

  update(id: string, body: { period_label?: string; due_date?: string; is_open?: boolean }) {
    return firstValueFrom(this.api.patch<FilingPeriod>(`/periods/${id}`, body));
  }
}

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private readonly api = inject(ApiClient);

  adminList(params: { page?: number; pageSize?: number; status?: string; filing_period_id?: string } = {}) {
    return firstValueFrom(
      this.api.get<PaginatedResult<Document>>('/admin/documents', params),
    );
  }

  listForUser(userId: string, params: { page?: number; pageSize?: number } = {}) {
    return firstValueFrom(
      this.api.get<PaginatedResult<Document>>(`/admin/users/${userId}/documents`, params),
    );
  }

  requestUploadUrl(body: {
    user_id?: string;
    filing_period_id: string;
    filename: string;
    contentType: string;
    file_type: string;
    file_size_bytes: number;
  }) {
    return firstValueFrom(this.api.post<UploadUrl>('/documents/upload-url', body));
  }

  downloadUrl(id: string) {
    return firstValueFrom(
      this.api.get<{ download_url: string }>(`/documents/${id}/download-url`),
    );
  }

  adminDownloadUrl(id: string) {
    return firstValueFrom(
      this.api.get<{ download_url: string }>(`/admin/documents/${id}/download-url`),
    );
  }

  markProcessed(id: string) {
    return firstValueFrom(
      this.api.patch<Document>(`/admin/documents/${id}/processed`),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly api = inject(ApiClient);

  adminList(params: { page?: number; pageSize?: number; filing_period_id?: string; report_type?: string } = {}) {
    return firstValueFrom(
      this.api.get<PaginatedResult<Report>>('/admin/reports', params),
    );
  }

  listForUser(userId: string, params: { page?: number; pageSize?: number } = {}) {
    return firstValueFrom(
      this.api.get<PaginatedResult<Report>>(`/admin/users/${userId}/reports`, params),
    );
  }

  requestUploadUrl(body: {
    user_id: string;
    filing_period_id: string;
    report_type: string;
    filename: string;
    contentType: string;
    file_size_bytes: number;
  }) {
    return firstValueFrom(this.api.post<ReportUploadUrl>('/admin/reports', body));
  }

  confirm(id: string) {
    return firstValueFrom(this.api.post<Report>(`/admin/reports/${id}/confirm`));
  }

  downloadUrl(id: string) {
    return firstValueFrom(
      this.api.get<{ download_url: string }>(`/admin/reports/${id}/download-url`),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class RemindersService {
  private readonly api = inject(ApiClient);

  send(body: {
    user_id?: string;
    all_unfiled?: boolean;
    filing_period_id: string;
    channels: string[];
  }) {
    return firstValueFrom(this.api.post<SendReminderResult>('/admin/reminders/send', body));
  }

  log(params: { page?: number; pageSize?: number; filing_period_id?: string; status?: string; channel?: string } = {}) {
    return firstValueFrom(
      this.api.get<PaginatedResult<Reminder>>('/admin/reminders/log', params),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly api = inject(ApiClient);

  list() {
    return firstValueFrom(this.api.get<Admin[]>('/admin/staff'));
  }

  create(body: { name: string; email: string; password: string; role?: string; status?: string }) {
    return firstValueFrom(this.api.post<Admin>('/admin/staff', body));
  }

  update(id: string, body: { name?: string; status?: string }) {
    return firstValueFrom(this.api.patch<Admin>(`/admin/staff/${id}`, body));
  }

  deactivate(id: string) {
    return firstValueFrom(this.api.delete<{ success: boolean }>(`/admin/staff/${id}`));
  }

  getPermissions(id: string) {
    return firstValueFrom(this.api.get<Permission[]>(`/admin/staff/${id}/permissions`));
  }

  setPermissions(id: string, permission_keys: string[]) {
    return firstValueFrom(
      this.api.put<Permission[]>(`/admin/staff/${id}/permissions`, { permission_keys }),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly api = inject(ApiClient);

  list(params: { page?: number; pageSize?: number; admin_id?: string; action?: string; from?: string; to?: string } = {}) {
    return firstValueFrom(
      this.api.get<PaginatedResult<AuditLog>>('/admin/audit-logs', params),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class WebsiteService {
  private readonly api = inject(ApiClient);

  listPosts(params: { page?: number; pageSize?: number; status?: string } = {}) {
    return firstValueFrom(
      this.api.get<PaginatedResult<BlogPost>>('/admin/website/blog-posts', params),
    );
  }

  getPost(id: string) {
    return firstValueFrom(this.api.get<BlogPost>(`/admin/website/blog-posts/${id}`));
  }

  createPost(body: { title: string; slug?: string; excerpt?: string; content_md: string }) {
    return firstValueFrom(this.api.post<BlogPost>('/admin/website/blog-posts', body));
  }

  updatePost(
    id: string,
    body: { title?: string; slug?: string; excerpt?: string; content_md?: string },
  ) {
    return firstValueFrom(this.api.patch<BlogPost>(`/admin/website/blog-posts/${id}`, body));
  }

  publishPost(id: string) {
    return firstValueFrom(
      this.api.post<BlogPost>(`/admin/website/blog-posts/${id}/publish`),
    );
  }

  unpublishPost(id: string) {
    return firstValueFrom(
      this.api.post<BlogPost>(`/admin/website/blog-posts/${id}/unpublish`),
    );
  }

  deletePost(id: string) {
    return firstValueFrom(
      this.api.delete<{ success: boolean }>(`/admin/website/blog-posts/${id}`),
    );
  }

  listLeads(params: { page?: number; pageSize?: number; status?: string } = {}) {
    return firstValueFrom(
      this.api.get<PaginatedResult<Lead>>('/admin/website/leads', params),
    );
  }

  setLeadStatus(id: string, status: string) {
    return firstValueFrom(
      this.api.patch<Lead>(`/admin/website/leads/${id}/status`, { status }),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class ServicesOfferedService {
  private readonly api = inject(ApiClient);

  list() {
    return firstValueFrom(this.api.get<Service[]>('/admin/services'));
  }

  get(id: string) {
    return firstValueFrom(this.api.get<Service>(`/admin/services/${id}`));
  }

  create(body: { title: string; description: string; price?: string; icon?: string; display_order?: number; is_active?: boolean }) {
    return firstValueFrom(this.api.post<Service>('/admin/services', body));
  }

  update(id: string, body: { title?: string; description?: string; price?: string; icon?: string; display_order?: number; is_active?: boolean }) {
    return firstValueFrom(this.api.patch<Service>(`/admin/services/${id}`, body));
  }

  deactivate(id: string) {
    return firstValueFrom(this.api.delete<{ success: boolean }>(`/admin/services/${id}`));
  }
}

@Injectable({ providedIn: 'root' })
export class TicketsService {
  private readonly api = inject(ApiClient);

  list(params: { page?: number; pageSize?: number; status?: string; user_id?: string } = {}) {
    return firstValueFrom(
      this.api.get<PaginatedResult<Ticket>>('/admin/tickets', params),
    );
  }

  get(id: string) {
    return firstValueFrom(this.api.get<Ticket>(`/admin/tickets/${id}`));
  }

  reply(id: string, message: string) {
    return firstValueFrom(
      this.api.post<TicketMessage>(`/admin/tickets/${id}/messages`, { message }),
    );
  }

    updateStatus(id: string, status: string) {
      return firstValueFrom(
        this.api.patch<Ticket>(`/admin/tickets/${id}/status`, { status }),
      );
    }

    attachmentDownloadUrl(attachmentId: string) {
      return firstValueFrom(
        this.api.post<{ download_url: string }>(
          `/admin/tickets/attachments/${attachmentId}/download-url`,
        ),
      );
    }
  }
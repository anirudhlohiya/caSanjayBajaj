import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from './api-client.service';
import {
  ClientCertificate,
  Document,
  DocumentCategory,
  DownloadUrlResponse,
  DueDate,
  FamilyMember,
  GstFilingPeriod,
  ItrReturn,
  PaginatedResult,
  Report,
  ReportNotification,
  ReportType,
  Service,
  ServiceDetail,
  ServiceRequest,
  ServiceRequestType,
  Ticket,
  TicketMessage,
  ReportRequest,
} from '../models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private readonly api: ApiClient) {}

  listOpenPeriods(): Promise<GstFilingPeriod[]> {
    return firstValueFrom(this.api.get<GstFilingPeriod[]>('/periods/open'));
  }

  pendingDocuments(): Promise<PaginatedResult<Document>> {
    return firstValueFrom(
      this.api.get<PaginatedResult<Document>>('/me/documents?status=pending'),
    );
  }

  latestReports(): Promise<PaginatedResult<Report>> {
    return firstValueFrom(
      this.api.get<PaginatedResult<Report>>('/me/reports?pageSize=5'),
    );
  }

  unreadNotifications(): Promise<PaginatedResult<ReportNotification>> {
    return firstValueFrom(
      this.api.get<PaginatedResult<ReportNotification>>(
        '/me/notifications?unread_only=true&pageSize=20',
      ),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class PeriodsService {
  constructor(private readonly api: ApiClient) {}

  list(): Promise<GstFilingPeriod[]> {
    return firstValueFrom(this.api.get<GstFilingPeriod[]>('/periods'));
  }

  open(): Promise<GstFilingPeriod[]> {
    return firstValueFrom(this.api.get<GstFilingPeriod[]>('/periods/open'));
  }
}

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  constructor(private readonly api: ApiClient) {}

  list(opts: {
    filingPeriodId?: string;
    status?: string;
    category?: DocumentCategory;
    assessmentYear?: string;
    /** A family member id, or 'self' for the account holder's own documents. */
    familyMemberId?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<PaginatedResult<Document>> {
    const params = new URLSearchParams();
    if (opts.filingPeriodId) params.set('filing_period_id', opts.filingPeriodId);
    if (opts.status) params.set('status', opts.status);
    if (opts.category) params.set('category', opts.category);
    if (opts.assessmentYear) params.set('assessment_year', opts.assessmentYear);
    if (opts.familyMemberId) params.set('family_member_id', opts.familyMemberId);
    params.set('page', String(opts.page ?? 1));
    params.set('pageSize', String(opts.pageSize ?? 50));
    return firstValueFrom(
      this.api.get<PaginatedResult<Document>>(`/me/documents?${params}`),
    );
  }

  requestUploadUrl(body: {
    category?: DocumentCategory;
    filing_period_id?: string;
    assessment_year?: string;
    family_member_id?: string;
    filename: string;
    contentType: string;
    file_type: 'pdf' | 'image' | 'excel';
    file_size_bytes: number;
  }): Promise<{ document_id: string; upload_url: string; expires_in: number }> {
    return firstValueFrom(
      this.api.post<{
        document_id: string;
        upload_url: string;
        expires_in: number;
      }>('/documents/upload-url', body),
    );
  }

  confirmUpload(
    id: string,
    fileSizeBytes: number,
  ): Promise<Document> {
    return firstValueFrom(
      this.api.post<Document>(`/documents/${id}/confirm`, {
        file_size_bytes: fileSizeBytes,
      }),
    );
  }

  downloadUrl(id: string): Promise<DownloadUrlResponse> {
    return firstValueFrom(
      this.api.get<DownloadUrlResponse>(`/documents/${id}/download-url`),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  constructor(private readonly api: ApiClient) {}

  list(opts: {
    filingPeriodId?: string;
    reportType?: ReportType;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<Report>> {
    const params = new URLSearchParams();
    if (opts.filingPeriodId) params.set('filing_period_id', opts.filingPeriodId);
    if (opts.reportType) params.set('report_type', opts.reportType);
    params.set('page', String(opts.page ?? 1));
    params.set('pageSize', String(opts.pageSize ?? 50));
    return firstValueFrom(
      this.api.get<PaginatedResult<Report>>(`/me/reports?${params}`),
    );
  }

  downloadUrl(id: string): Promise<DownloadUrlResponse> {
    return firstValueFrom(
      this.api.get<DownloadUrlResponse>(`/me/reports/${id}/download-url`),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  /** Unread inbox count, shown as the badge on the header bell. */
  readonly unreadCount = signal(0);

  constructor(private readonly api: ApiClient) {}

  async refreshUnread(): Promise<void> {
    try {
      const result = await this.list({ unreadOnly: true, pageSize: 1 });
      this.unreadCount.set(result.total);
    } catch {
      /* non-fatal: keep the last known count */
    }
  }

  list(opts: {
    unreadOnly?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<ReportNotification>> {
    const params = new URLSearchParams();
    if (opts.unreadOnly) params.set('unread_only', 'true');
    params.set('page', String(opts.page ?? 1));
    params.set('pageSize', String(opts.pageSize ?? 30));
    return firstValueFrom(
      this.api.get<PaginatedResult<ReportNotification>>(
        `/me/notifications?${params}`,
      ),
    );
  }

  async markAllRead(): Promise<{ success: boolean }> {
    const result = await firstValueFrom(
      this.api.post<{ success: boolean }>('/me/notifications/read-all'),
    );
    this.unreadCount.set(0);
    return result;
  }

  async markRead(id: string): Promise<ReportNotification> {
    const result = await firstValueFrom(
      this.api.post<ReportNotification>(`/me/notifications/${id}/read`),
    );
    this.unreadCount.update((n) => Math.max(n - 1, 0));
    return result;
  }
}

@Injectable({ providedIn: 'root' })
export class DueDatesService {
  constructor(private readonly api: ApiClient) {}

  list(fy: string): Promise<DueDate[]> {
    return firstValueFrom(
      this.api.get<DueDate[]>(`/due-dates?fy=${encodeURIComponent(fy)}`),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class FamilyMembersService {
  constructor(private readonly api: ApiClient) {}

  list(): Promise<FamilyMember[]> {
    return firstValueFrom(this.api.get<FamilyMember[]>('/me/family-members'));
  }

  create(body: { name: string; relation: string; pan: string }): Promise<FamilyMember> {
    return firstValueFrom(this.api.post<FamilyMember>('/me/family-members', body));
  }

  update(
    id: string,
    body: { name: string; relation: string; pan: string },
  ): Promise<FamilyMember> {
    return firstValueFrom(
      this.api.patch<FamilyMember>(`/me/family-members/${id}`, body),
    );
  }

  remove(id: string): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.api.delete<{ success: boolean }>(`/me/family-members/${id}`),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  constructor(private readonly api: ApiClient) {}

  update(body: { name?: string; phone?: string; gstin?: string; dob?: string }) {
    return firstValueFrom(this.api.patch('/me', body));
  }

  changePassword(current_password: string, new_password: string) {
    return firstValueFrom(
      this.api.post<{ success: boolean }>('/me/change-password', {
        current_password,
        new_password,
      }),
    );
  }

  registerDeviceToken(push_token: string, platform: 'pwa' | 'android' = 'pwa') {
    return firstValueFrom(
      this.api.post('/me/device-token', { push_token, platform }),
    );
  }

  unregisterDeviceToken(push_token: string) {
    return firstValueFrom(
      this.api.delete('/me/device-token', { push_token }),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class CertificatesService {
  constructor(private readonly api: ApiClient) {}

  list(): Promise<ClientCertificate[]> {
    return firstValueFrom(this.api.get<ClientCertificate[]>('/me/certificates'));
  }

  downloadUrl(id: string): Promise<DownloadUrlResponse> {
    return firstValueFrom(
      this.api.get<DownloadUrlResponse>(`/me/certificates/${id}/download-url`),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class TicketsService {
  constructor(private readonly api: ApiClient) {}

  list(opts: { page?: number; pageSize?: number; status?: string } = {}): Promise<PaginatedResult<Ticket>> {
    const params = new URLSearchParams();
    if (opts.status) params.set('status', opts.status);
    params.set('page', String(opts.page ?? 1));
    params.set('pageSize', String(opts.pageSize ?? 20));
    return firstValueFrom(
      this.api.get<PaginatedResult<Ticket>>(`/me/tickets?${params}`),
    );
  }

  get(id: string): Promise<Ticket> {
    return firstValueFrom(this.api.get<Ticket>(`/me/tickets/${id}`));
  }

  create(body: { subject: string; category?: string; priority?: string; message: string }): Promise<Ticket> {
    return firstValueFrom(this.api.post<Ticket>('/me/tickets', body));
  }

  reply(id: string, message: string): Promise<TicketMessage> {
    return firstValueFrom(
      this.api.post<TicketMessage>(`/me/tickets/${id}/messages`, { message }),
    );
  }

    close(id: string): Promise<Ticket> {
      return firstValueFrom(this.api.post<Ticket>(`/me/tickets/${id}/close`));
    }

    attachmentUploadUrl(body: {
      message_id: string;
      filename: string;
      content_type: string;
      file_size_bytes: number;
    }): Promise<{ attachment_id: string; upload_url: string; s3_key: string }> {
      return firstValueFrom(
        this.api.post<{ attachment_id: string; upload_url: string; s3_key: string }>(
          '/me/tickets/attachment-upload-url',
          body,
        ),
      );
    }

    attachmentDownloadUrl(attachmentId: string): Promise<{ download_url: string }> {
      return firstValueFrom(
        this.api.post<{ download_url: string }>(
          `/me/tickets/attachments/${attachmentId}/download-url`,
        ),
      );
    }
  }

@Injectable({ providedIn: 'root' })
export class ServicesOfferedService {
  constructor(private readonly api: ApiClient) {}

  listActive(): Promise<Service[]> {
    return firstValueFrom(this.api.get<Service[]>('/services'));
  }

  get(slug: string): Promise<ServiceDetail> {
    return firstValueFrom(
      this.api.get<ServiceDetail>(`/services/${encodeURIComponent(slug)}`),
    );
  }

  /** "Request this service" — opens a support ticket for the firm. */
  enquire(slug: string, message: string): Promise<Ticket> {
    return firstValueFrom(
      this.api.post<Ticket>(
        `/services/${encodeURIComponent(slug)}/enquiry`,
        { message },
      ),
    );
  }
}

export interface ComplianceTask {
  id: string;
  user_id: string;
  filing_period_id: string;
  category: string;
  status: string;
  due_date: string | null;
  amount: string | null;
  paid_at: string | null;
  nil_declared_at?: string | null;
  message_day?: number | null;
  /** Set when the CA has filed this return (GSTR-1 / IFF / GSTR-3B). */
  filed_at?: string | null;
  arn?: string | null;
  filed_report_id?: string | null;
  filing_period?: GstFilingPeriod;
}

@Injectable({ providedIn: 'root' })
export class ComplianceTasksService {
  constructor(private readonly api: ApiClient) {}

  list(periodId?: string): Promise<ComplianceTask[]> {
    const params = new URLSearchParams();
    if (periodId) params.set('periodId', periodId);
    return firstValueFrom(
      this.api.get<ComplianceTask[]>(`/compliance-tasks?${params}`)
    );
  }

  autoGenerate(periodId: string, isQuarterly: boolean): Promise<ComplianceTask[]> {
    return firstValueFrom(
      this.api.post<ComplianceTask[]>('/compliance-tasks/auto-generate', { periodId, isQuarterly })
    );
  }

  markNil(id: string): Promise<ComplianceTask> {
    return firstValueFrom(
      this.api.post<ComplianceTask>(`/compliance-tasks/${id}/nil`, {})
    );
  }
}

@Injectable({ providedIn: 'root' })
export class ReportRequestsService {
  constructor(private readonly api: ApiClient) {}

  list(params: { page?: number; pageSize?: number } = {}) {
    const urlParams = new URLSearchParams();
    if (params.page) urlParams.set('page', params.page.toString());
    if (params.pageSize) urlParams.set('pageSize', params.pageSize.toString());
    return firstValueFrom(
      this.api.get<PaginatedResult<ReportRequest>>(`/me/report-requests?${urlParams}`)
    );
  }

  create(periodId: string) {
    return firstValueFrom(
      this.api.post<ReportRequest>('/me/report-requests', { filing_period_id: periodId })
    );
  }
}

@Injectable({ providedIn: 'root' })
export class ServiceRequestsService {
  constructor(private readonly api: ApiClient) {}

  create(body: {
    requested_type: ServiceRequestType;
    business_name?: string;
    gstin?: string;
    filing_frequency?: string;
    industry?: string;
    pan?: string;
  }): Promise<ServiceRequest> {
    return firstValueFrom(
      this.api.post<ServiceRequest>('/me/service-requests', body),
    );
  }

  myRequests(): Promise<ServiceRequest[]> {
    return firstValueFrom(
      this.api.get<ServiceRequest[]>('/me/service-requests'),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class ItrReturnsService {
  constructor(private readonly api: ApiClient) {}

  myReturns(): Promise<ItrReturn[]> {
    return firstValueFrom(this.api.get<ItrReturn[]>('/me/itr-returns'));
  }

  listMine(): Promise<ItrReturn[]> {
    return this.myReturns();
  }
}


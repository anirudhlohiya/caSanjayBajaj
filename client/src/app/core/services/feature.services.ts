import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from './api-client.service';
import {
  Document,
  DownloadUrlResponse,
  GstFilingPeriod,
  PaginatedResult,
  Report,
  ReportNotification,
  ReportType,
  Service,
  Ticket,
  TicketMessage,
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
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<Document>> {
    const params = new URLSearchParams();
    if (opts.filingPeriodId) params.set('filing_period_id', opts.filingPeriodId);
    if (opts.status) params.set('status', opts.status);
    params.set('page', String(opts.page ?? 1));
    params.set('pageSize', String(opts.pageSize ?? 50));
    return firstValueFrom(
      this.api.get<PaginatedResult<Document>>(`/me/documents?${params}`),
    );
  }

  requestUploadUrl(body: {
    filing_period_id: string;
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
  constructor(private readonly api: ApiClient) {}

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

  markAllRead(): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.api.post<{ success: boolean }>('/me/notifications/read-all'),
    );
  }

  markRead(id: string): Promise<ReportNotification> {
    return firstValueFrom(
      this.api.post<ReportNotification>(`/me/notifications/${id}/read`),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  constructor(private readonly api: ApiClient) {}

  update(body: { name?: string; phone?: string; gstin?: string }) {
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
}

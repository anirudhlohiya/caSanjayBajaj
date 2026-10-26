import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from './api-client.service';
import type {
  AuditLog,
  BlogPost,
  CertType,
  Client,
  ClientCertificate,
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
  ServiceContact,
  DueDate,
  Faq,
  Ticket,
  TicketMessage,
  UploadUrl,
  Admin,
  ReportRequest,
  ServiceRequest,
  ItrReturn,
  FamilyMember,
  UserType,
  WhatsappConversation,
  WhatsappMessage,
  WhatsappTemplateOption,
  WhatsappUsageStats,
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

  search(term: string, pageSize = 8) {
    return firstValueFrom(
      this.api.get<PaginatedResult<Client>>('/admin/users', { page: 1, pageSize, search: term }),
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
    business_name?: string;
    industry?: string;
    pan?: string;
    user_type?: string;
    status?: string;
    gst_filing_frequency?: 'monthly' | 'quarterly';
  }) {
    return firstValueFrom(this.api.post<Client>('/admin/users', body));
  }

  update(
    id: string,
    body: {
      name?: string;
      phone?: string;
      gstin?: string;
      business_name?: string;
      industry?: string;
      pan?: string;
      status?: string;
      gst_filing_frequency?: 'monthly' | 'quarterly';
    },
  ) {
    return firstValueFrom(this.api.patch<Client>(`/admin/users/${id}`, body));
  }

  changeType(id: string, user_type: UserType) {
    return firstValueFrom(
      this.api.patch<Client>(`/admin/clients/${id}/type`, { user_type }),
    );
  }

  deactivate(id: string) {
    return firstValueFrom(this.api.delete<{ success: boolean }>(`/admin/users/${id}`));
  }
}

@Injectable({ providedIn: 'root' })
export class ServiceRequestsAdminService {
  private readonly api = inject(ApiClient);

  listPending() {
    return firstValueFrom(
      this.api.get<ServiceRequest[]>('/admin/service-requests?status=pending'),
    );
  }

  review(id: string, action: 'approve' | 'reject', note?: string) {
    return firstValueFrom(
      this.api.patch<ServiceRequest>(`/admin/service-requests/${id}`, {
        action,
        note,
      }),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class FamilyMembersAdminService {
  private readonly api = inject(ApiClient);

  list(clientId: string) {
    return firstValueFrom(this.api.get<FamilyMember[]>(`/admin/clients/${clientId}/family-members`));
  }

  create(clientId: string, body: { name: string; relation: string; pan: string }) {
    return firstValueFrom(this.api.post<FamilyMember>(`/admin/clients/${clientId}/family-members`, body));
  }

  update(clientId: string, id: string, body: { name: string; relation: string; pan: string }) {
    return firstValueFrom(this.api.patch<FamilyMember>(`/admin/clients/${clientId}/family-members/${id}`, body));
  }

  remove(clientId: string, id: string) {
    return firstValueFrom(this.api.delete<{ success: boolean }>(`/admin/clients/${clientId}/family-members/${id}`));
  }
}

@Injectable({ providedIn: 'root' })
export class ItrReturnsAdminService {
  private readonly api = inject(ApiClient);

  listForClient(clientId: string) {
    return firstValueFrom(
      this.api.get<ItrReturn[]>(`/admin/clients/${clientId}/itr-returns`),
    );
  }

  requestUploadUrl(
    clientId: string,
    body: {
      assessment_year: string;
      filename: string;
      contentType: string;
    },
  ) {
    return firstValueFrom(
      this.api.post<{
        s3_key: string;
        upload_url: string;
        expires_in: number;
      }>(`/admin/clients/${clientId}/itr-returns/upload-url`, body),
    );
  }

  confirm(
    clientId: string,
    body: {
      assessment_year: string;
      family_member_id?: string;
      s3_key: string;
      filename: string;
      size: number;
    },
  ) {
    return firstValueFrom(
      this.api.post<ItrReturn>(`/admin/clients/${clientId}/itr-returns/confirm`, body),
    );
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

  create(body: { period_label: string; period_code: string; due_date: string; is_open?: boolean; schedule?: any }) {
    return firstValueFrom(this.api.post<FilingPeriod>('/periods', body));
  }

  update(id: string, body: { period_label?: string; due_date?: string; is_open?: boolean; schedule?: any }) {
    return firstValueFrom(this.api.patch<FilingPeriod>(`/periods/${id}`, body));
  }
}

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private readonly api = inject(ApiClient);

  adminList(
    params: {
      page?: number;
      pageSize?: number;
      status?: string;
      filing_period_id?: string;
      unassigned?: boolean;
    } = {},
  ) {
    return firstValueFrom(
      this.api.get<PaginatedResult<Document>>('/admin/documents', params),
    );
  }

  /** File a (WhatsApp) document under a GST month, or as ITR for the current AY. */
  assign(id: string, body: { category: 'gst' | 'itr'; filing_period_id?: string }) {
    return firstValueFrom(this.api.patch<Document>(`/admin/documents/${id}/assign`, body));
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
    sales?: string;
    purchases?: string;
    total_liability?: string;
    itc_claimed?: string;
    net_payable?: string;
  }) {
    return firstValueFrom(this.api.post<ReportUploadUrl>('/admin/reports', body));
  }

  /** notify=false when the report is a filed return attached via "Mark filed" (it alerts the client itself). */
  confirm(id: string, notify = true) {
    return firstValueFrom(
      this.api.post<Report>(`/admin/reports/${id}/confirm${notify ? '' : '?notify=false'}`),
    );
  }

  downloadUrl(id: string) {
    return firstValueFrom(
      this.api.get<{ download_url: string }>(`/admin/reports/${id}/download-url`),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class ReportRequestsService {
  private readonly api = inject(ApiClient);

  adminList(params: { page?: number; pageSize?: number; status?: string } = {}) {
    return firstValueFrom(
      this.api.get<PaginatedResult<ReportRequest>>('/admin/report-requests', params),
    );
  }

  fulfill(id: string, body: any) {
    return firstValueFrom(
      this.api.post<{ report_id: string; upload_url: string; expires_in: number }>(`/admin/report-requests/${id}/fulfill`, body),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class CertificatesService {
  private readonly api = inject(ApiClient);

  listForClient(userId: string) {
    return firstValueFrom(
      this.api.get<ClientCertificate[]>(`/admin/clients/${userId}/certificates`),
    );
  }

  uploadUrl(userId: string, body: {
    cert_type: CertType;
    filename: string;
    contentType: string;
  }) {
    return firstValueFrom(
      this.api.post<{ certificate_id: string; upload_url: string; expires_in: number }>(
        `/admin/clients/${userId}/certificates/upload-url`,
        body,
      ),
    );
  }

  confirm(userId: string, certId: string) {
    return firstValueFrom(
      this.api.post<ClientCertificate>(
        `/admin/clients/${userId}/certificates/${certId}/confirm`,
      ),
    );
  }

  downloadUrl(certId: string) {
    return firstValueFrom(
      this.api.get<{ download_url: string }>(`/me/certificates/${certId}/download-url`),
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

  create(body: ServiceInput) {
    return firstValueFrom(this.api.post<Service>('/admin/services', body));
  }

  update(id: string, body: Partial<ServiceInput>) {
    return firstValueFrom(this.api.patch<Service>(`/admin/services/${id}`, body));
  }

  deactivate(id: string) {
    return firstValueFrom(this.api.delete<{ success: boolean }>(`/admin/services/${id}`));
  }

  reorder(ids: string[]) {
    return firstValueFrom(this.api.post<Service[]>('/admin/services/reorder', { ids }));
  }

  getContact() {
    return firstValueFrom(this.api.get<ServiceContact>('/admin/services/settings/contact'));
  }

  setContact(body: Partial<ServiceContact>) {
    return firstValueFrom(this.api.put<ServiceContact>('/admin/services/settings/contact', body));
  }
}

@Injectable({ providedIn: 'root' })
export class FaqsAdminService {
  private readonly api = inject(ApiClient);

  list() {
    return firstValueFrom(this.api.get<Faq[]>('/admin/faqs'));
  }

  create(body: { category: string; question: string; answer_md: string; is_active: boolean }) {
    return firstValueFrom(this.api.post<Faq>('/admin/faqs', body));
  }

  update(id: string, body: Partial<{ category: string; question: string; answer_md: string; is_active: boolean }>) {
    return firstValueFrom(this.api.patch<Faq>(`/admin/faqs/${id}`, body));
  }

  reorder(ids: string[]) {
    return firstValueFrom(this.api.post<Faq[]>('/admin/faqs/reorder', { ids }));
  }

  remove(id: string) {
    return firstValueFrom(this.api.delete<{ success: boolean }>(`/admin/faqs/${id}`));
  }
}

@Injectable({ providedIn: 'root' })
export class DueDatesAdminService {
  private readonly api = inject(ApiClient);

  list(fy: string) {
    return firstValueFrom(this.api.get<DueDate[]>('/admin/due-dates', { fy }));
  }

  years() {
    return firstValueFrom(this.api.get<string[]>('/admin/due-dates/years'));
  }

  create(body: DueDateInput) {
    return firstValueFrom(this.api.post<DueDate>('/admin/due-dates', body));
  }

  update(id: string, body: Partial<DueDateInput>) {
    return firstValueFrom(this.api.patch<DueDate>(`/admin/due-dates/${id}`, body));
  }

  remove(id: string) {
    return firstValueFrom(this.api.delete<{ success: boolean }>(`/admin/due-dates/${id}`));
  }
}

export interface DueDateInput {
  title: string;
  form: string;
  category: string;
  due_date: string;
  original_due_date: string;
  period_label: string;
  description: string;
  audiences: string[];
  fy: string;
  is_active: boolean;
}

export interface ServiceInput {
  title: string;
  slug?: string;
  description: string;
  tags: string[];
  body_md: string;
  price: string;
  icon: string;
  icon_color: string;
  contact_phone: string;
  is_active: boolean;
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

@Injectable({ providedIn: 'root' })
export class RentAgreementsService {
  private readonly api = inject(ApiClient);

  getTemplates() {
    return firstValueFrom(this.api.get<{ data: any[] }>('/admin/rent-agreements/templates'));
  }

  getConfig() {
    return firstValueFrom(
      this.api.get<{ data: { onlyOfficeEnabled: boolean; libreOfficeEnabled: boolean } }>(
        '/admin/rent-agreements/config',
      ),
    );
  }

  list(params: { page?: number; limit?: number; template_id?: string } = {}) {
    return firstValueFrom(
      this.api.get<PaginatedResult<any>>('/admin/rent-agreements', params),
    );
  }

  summary() {
    return firstValueFrom(
      this.api.get<{ total: number; draft: number; generated: number }>('/admin/rent-agreements/summary'),
    );
  }

  remove(id: string) {
    return firstValueFrom(
      this.api.delete<{ data: { deleted: boolean } }>(`/admin/rent-agreements/${id}`),
    );
  }

  get(id: string) {
    return firstValueFrom(this.api.get<{ data: any }>(`/admin/rent-agreements/${id}`));
  }

  create(body: { template_id: string; form_data: any; status?: string }) {
    return firstValueFrom(this.api.post<{ data: any }>('/admin/rent-agreements', body));
  }

  update(id: string, body: { form_data?: any; status?: string }) {
    return firstValueFrom(this.api.put<{ data: any }>(`/admin/rent-agreements/${id}`, body));
  }

  preview(body: { template_id: string; form_data: any; status?: string }) {
    return firstValueFrom(this.api.post<{ data: string }>('/admin/rent-agreements/preview', body));
  }

  previewPdf(body: { template_id: string; form_data: any; status?: string }) {
    return firstValueFrom(this.api.postBlob('/admin/rent-agreements/preview-pdf', body));
  }

  previewPdfForAgreement(id: string) {
    return firstValueFrom(this.api.getBlob(`/admin/rent-agreements/${id}/preview/pdf`));
  }

  convertEditedHtml(html: string) {
    return firstValueFrom(this.api.postBlob('/admin/rent-agreements/convert-to-docx', { html }));
  }

  getOfficeConfig(id: string) {
    return firstValueFrom(
      this.api.get<{ data: { serverUrl: string; config: any } }>(`/admin/rent-agreements/${id}/office/config`),
    );
  }

  // Uses browser native navigation for download
  getDownloadUrl(id: string): string {
    return `${this.api.baseUrl}/admin/rent-agreements/${id}/download/docx`;
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
  filed_at?: string | null;
  arn?: string | null;
  filed_report_id?: string | null;
  payment_reminder_sent_at?: string | null;
}

export interface ClientAlertChannels {
  in_app: boolean;
  push: boolean;
  email: boolean;
  whatsapp: boolean;
}

@Injectable({ providedIn: 'root' })
export class ComplianceTasksService {
  private readonly api = inject(ApiClient);
  
  listForClient(clientId: string, periodId: string): Promise<ComplianceTask[]> {
    return firstValueFrom(
      this.api.get<ComplianceTask[]>(`/compliance-tasks/admin/client/${clientId}`, {
        periodId
      })
    );
  }

  autoGenerateTasks(clientId: string, periodId: string, isQuarterly: boolean): Promise<ComplianceTask[]> {
    return firstValueFrom(
      this.api.post<ComplianceTask[]>(`/compliance-tasks/admin/client/${clientId}/auto-generate`, {
        periodId,
        isQuarterly
      })
    );
  }

  updatePayment(id: string, amount: string, paidAt: string): Promise<ComplianceTask> {
    return firstValueFrom(
      this.api.patch<ComplianceTask>(`/compliance-tasks/admin/${id}/payment`, {
        amount,
        paidAt
      })
    );
  }

  updateStatus(id: string, status: string): Promise<ComplianceTask> {
    return firstValueFrom(
      this.api.patch<ComplianceTask>(`/compliance-tasks/admin/${id}/status`, {
        status
      })
    );
  }

  pendingNilFilings(): Promise<ComplianceTask[]> {
    return firstValueFrom(
      this.api.get<ComplianceTask[]>('/compliance-tasks/admin/nil-pending')
    );
  }

  confirmNil(id: string): Promise<ComplianceTask> {
    return firstValueFrom(
      this.api.patch<ComplianceTask>(`/compliance-tasks/admin/${id}/nil-confirm`)
    );
  }

  /** Marks a GSTR-1 / IFF / GSTR-3B return filed and alerts the client on all channels. */
  markFiled(id: string, body: { arn?: string; report_id?: string }): Promise<ComplianceTask> {
    return firstValueFrom(
      this.api.patch<ComplianceTask>(`/compliance-tasks/admin/${id}/filed`, body)
    );
  }

  /** Manual GST payment reminder (in-app, push, email, WhatsApp). */
  sendPaymentReminder(id: string): Promise<{ task: ComplianceTask; channels: ClientAlertChannels }> {
    return firstValueFrom(
      this.api.post<{ task: ComplianceTask; channels: ClientAlertChannels }>(
        `/compliance-tasks/admin/${id}/payment-reminder`
      )
    );
  }
}

@Injectable({ providedIn: 'root' })
export class WhatsappChatsService {
  private readonly api = inject(ApiClient);

  listConversations(
    params: {
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    return firstValueFrom(
      this.api.get<{
        items: WhatsappConversation[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>('/whatsapp-chats/conversations', params),
    );
  }

  getUsage() {
    return firstValueFrom(
      this.api.get<WhatsappUsageStats>('/whatsapp-chats/usage'),
    );
  }

  getMessages(
    conversationId: string,
    params: { limit?: number; before?: string } = {},
  ) {
    return firstValueFrom(
      this.api.get<WhatsappMessage[]>(
        `/whatsapp-chats/conversations/${conversationId}/messages`,
        params,
      ),
    );
  }

  sendStaffMessage(conversationId: string, body: string) {
    return firstValueFrom(
      this.api.post<WhatsappMessage>(
        `/whatsapp-chats/conversations/${conversationId}/messages`,
        { body },
      ),
    );
  }

  takeover(conversationId: string) {
    return firstValueFrom(
      this.api.patch<WhatsappConversation>(
        `/whatsapp-chats/conversations/${conversationId}/takeover`,
      ),
    );
  }

  release(conversationId: string) {
    return firstValueFrom(
      this.api.patch<WhatsappConversation>(
        `/whatsapp-chats/conversations/${conversationId}/release`,
      ),
    );
  }

  escalate(conversationId: string) {
    return firstValueFrom(
      this.api.patch<WhatsappConversation>(
        `/whatsapp-chats/conversations/${conversationId}/escalate`,
      ),
    );
  }

  close(conversationId: string) {
    return firstValueFrom(
      this.api.patch<WhatsappConversation>(
        `/whatsapp-chats/conversations/${conversationId}/close`,
      ),
    );
  }

  markAsRead(conversationId: string) {
    return firstValueFrom(
      this.api.patch<WhatsappConversation>(
        `/whatsapp-chats/conversations/${conversationId}/read`,
      ),
    );
  }

  updateMetadata(
    conversationId: string,
    dto: {
      clientName?: string;
      businessName?: string;
      gstin?: string;
      verified?: boolean;
      internalNotes?: string;
    },
  ) {
    return firstValueFrom(
      this.api.patch<WhatsappConversation>(
        `/whatsapp-chats/conversations/${conversationId}`,
        dto,
      ),
    );
  }

  listTemplates() {
    return firstValueFrom(
      this.api.get<WhatsappTemplateOption[]>('/whatsapp-chats/templates'),
    );
  }

  /** Start a chat with a template (client_id or phone). Thread goes to staff takeover. */
  startConversation(body: {
    client_id?: string;
    phone?: string;
    template: string;
    language: string;
    params: string[];
  }) {
    return firstValueFrom(
      this.api.post<{ conversation: WhatsappConversation; message: WhatsappMessage }>(
        '/whatsapp-chats/conversations/start',
        body,
      ),
    );
  }

  /** Template inside an existing chat (needed once the 24h window has closed). */
  sendTemplate(
    conversationId: string,
    body: { template: string; language: string; params: string[] },
  ) {
    return firstValueFrom(
      this.api.post<{ conversation: WhatsappConversation; message: WhatsappMessage }>(
        `/whatsapp-chats/conversations/${conversationId}/template`,
        body,
      ),
    );
  }

  getStreamUrl(token?: string): string {
    const base = `${this.api.baseUrl}/whatsapp-chats/stream`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  }
}
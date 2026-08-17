export type UserType = 'gst' | 'itr';
export type UserStatus = 'active' | 'inactive';
export type AdminRole = 'super_admin' | 'staff';
export type AdminStatus = 'active' | 'inactive';
export type DocumentFileType = 'pdf' | 'image' | 'excel';
export type DocumentStatus = 'pending' | 'received' | 'processed';
export type ReportType = 'gstr_1' | 'gstr_3b' | 'reconciliation' | 'other';
export type ReminderChannel = 'push' | 'email';
export type ReminderStatus = 'queued' | 'sent' | 'failed';

export const PERMISSIONS = [
  'view_clients',
  'view_documents',
  'upload_reports',
  'send_reminders',
  'manage_staff',
  'view_audit_logs',
  'manage_settings',
] as const;
export type PermissionKey = (typeof PERMISSIONS)[number];

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

export interface AuthUser {
  sub: string;
  type: 'user' | 'admin';
  email: string;
  role?: AdminRole;
  permissions?: string[];
}

export interface Admin {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: AdminStatus;
  created_at: string;
}

export interface Permission {
  id: string;
  admin_id: string;
  permission_key: string;
  granted: boolean;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  gstin: string | null;
  user_type: UserType;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface FilingPeriod {
  id: string;
  period_label: string;
  period_code: string;
  due_date: string;
  is_open: boolean;
  created_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  filing_period_id: string;
  s3_key: string;
  original_filename: string;
  file_type: DocumentFileType;
  file_size_bytes: string;
  status: DocumentStatus;
  uploaded_at: string;
  processed_at: string | null;
  user?: Client;
  filing_period?: FilingPeriod;
}

export interface Report {
  id: string;
  user_id: string;
  filing_period_id: string;
  report_type: ReportType;
  s3_key: string;
  original_filename: string;
  sent_by_admin_id: string | null;
  sent_at: string;
  user?: Client;
  filing_period?: FilingPeriod;
}

export interface Reminder {
  id: string;
  user_id: string;
  filing_period_id: string;
  channel: ReminderChannel;
  status: ReminderStatus;
  sent_at: string | null;
  triggered_by: string;
  created_at: string;
  user?: Client;
  filing_period?: FilingPeriod;
}

export interface AuditLog {
  id: string;
  admin_id: string | null;
  action: string;
  target_user_id: string | null;
  target_period_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
  admin?: Admin | null;
  target_user?: Client | null;
  target_period?: FilingPeriod | null;
}

export type ActivityType = 'document' | 'report' | 'reminder';

export interface RecentActivityItem {
  type: ActivityType;
  client_name: string;
  action: string;
  status: string;
  created_at: string;
}

export interface DashboardStats {
  total_clients: number;
  active_clients: number;
  documents_received: number;
  documents_processed: number;
  reports_total: number;
  reports_this_month: number;
  reminders_sent_total: number;
  open_periods: number;
  upcoming_due_dates: FilingPeriod[];
  recent_activity: RecentActivityItem[];
}

export interface UploadUrl {
  document_id: string;
  upload_url: string;
  expires_in: number;
}

export interface ReportUploadUrl {
  report_id: string;
  upload_url: string;
  expires_in: number;
}

export interface SendReminderResult {
  total: number;
  sent: number;
}

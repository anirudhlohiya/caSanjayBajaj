import { environment } from '../../environments/environment';

function apiUrl(): string {
  const override = localStorage.getItem('FP_API_URL');
  return override || environment.apiBaseUrl;
}

function vapidKey(): string {
  const override = localStorage.getItem('FP_VAPID_KEY');
  return override || environment.vapidPublicKey;
}

export const APP = {
  apiBaseUrl: apiUrl(),
  vapidPublicKey: vapidKey(),
  tokens: {
    access: 'fp_user_access',
    refresh: 'fp_user_refresh',
  },
} as const;

export type UserType = 'gst' | 'itr';
export type UserStatus = 'active' | 'inactive';
export type DocumentStatus = 'pending' | 'received' | 'processed';
export type DocumentFileType = 'pdf' | 'image' | 'excel';
export type ReportType = 'gstr_1' | 'gstr_3b' | 'reconciliation' | 'other';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface JwtPayload {
  sub: string;
  type: 'user' | 'admin';
  email: string;
  role?: string;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

export interface UserProfile {
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

export interface GstFilingPeriod {
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
  original_filename: string;
  file_type: DocumentFileType;
  file_size_bytes: string;
  status: DocumentStatus;
  uploaded_at: string;
  processed_at: string | null;
  filing_period?: GstFilingPeriod;
}

export interface Report {
  id: string;
  user_id: string;
  filing_period_id: string;
  report_type: ReportType;
  original_filename: string;
  sent_by_admin_id: string | null;
  sent_at: string;
  filing_period?: GstFilingPeriod;
}

export interface ReportNotification {
  id: string;
  title: string;
  body: string;
  deep_link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UploadUrlResponse {
  document_id: string;
  upload_url: string;
  expires_in: number;
}

export interface DownloadUrlResponse {
  download_url: string;
}

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  gstr_1: 'GSTR-1',
  gstr_3b: 'GSTR-3B',
  reconciliation: 'Reconciliation',
  other: 'Other',
};

export const REPORT_TYPE_LABELS_LONG: Record<ReportType, string> = {
  gstr_1: 'GSTR-1 (Outward Supplies)',
  gstr_3b: 'GSTR-3B (Monthly Return)',
  reconciliation: 'Reconciliation Statement',
  other: 'Other Report',
};

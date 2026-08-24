export enum UserType {
  GST = 'gst',
  ITR = 'itr',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  STAFF = 'staff',
}

export enum AdminStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum DocumentFileType {
  PDF = 'pdf',
  IMAGE = 'image',
  EXCEL = 'excel',
}

export enum DocumentStatus {
  PENDING = 'pending',
  RECEIVED = 'received',
  PROCESSED = 'processed',
}

export enum ReportType {
  GSTR_1 = 'gstr_1',
  GSTR_3B = 'gstr_3b',
  RECONCILIATION = 'reconciliation',
  OTHER = 'other',
}

export enum ReminderChannel {
  PUSH = 'push',
  EMAIL = 'email',
}

export enum ReminderStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  FAILED = 'failed',
}

export enum SubjectType {
  USER = 'user',
  ADMIN = 'admin',
}

export enum DevicePlatform {
  PWA = 'pwa',
  ANDROID = 'android',
}

export enum PostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  CLOSED = 'closed',
}

export const PERMISSIONS = [
  'view_clients',
  'view_documents',
  'upload_reports',
  'send_reminders',
  'manage_staff',
  'view_audit_logs',
  'manage_settings',
  'manage_website',
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

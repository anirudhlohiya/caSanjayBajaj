export enum UserType {
  GENERAL = 'general',
  GST = 'gst',
  ITR = 'itr',
  BOTH = 'both',
  NORMAL = 'normal',
}

export enum DocumentCategory {
  GST = 'gst',
  ITR = 'itr',
  GENERAL = 'general',
}

export enum ServiceRequestType {
  GST = 'gst',
  ITR = 'itr',
  BOTH = 'both',
}

export enum ServiceRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
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
  WHATSAPP = 'whatsapp',
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

export enum ComplianceCategory {
  GSTR_1 = 'gstr_1',
  IFF = 'iff',
  GSTR_3B = 'gstr_3b',
  GST_PAYMENT = 'gst_payment',
  /**
   * Legacy values retained in the DB (see docs/13 §6.4). Never generate new
   * tasks with these — sales/purchase bills are merged into gstr_1/gstr_3b.
   */
  SALES_BILLS = 'sales_bills',
  PURCHASE_BILLS = 'purchase_bills',
}

export enum TaskStatus {
  PENDING = 'pending',
  UPLOADED = 'uploaded',
  COMPLETED = 'completed',
  NIL_DECLARED = 'nil_declared',
}

export enum CertType {
  GST_CERT = 'gst_cert',
  UDYAM_CERT = 'udyam_cert',
}

export enum GstFilingFrequency {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
}

export enum ReportRequestStatus {
  PENDING = 'pending',
  FULFILLED = 'fulfilled',
  REJECTED = 'rejected',
}

export const PERMISSIONS = [
  'view_clients',
  'manage_clients',
  'view_documents',
  'manage_documents',
  'view_reports',
  'manage_reports',
  'send_reminders',
  'manage_tickets',
  'manage_whatsapp',
  'manage_rent_agreements',
  'manage_website',
  'manage_settings',
  'view_audit_logs',
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

/**
 * Granting the key on the left always grants the keys on the right: "can
 * change" includes "can view", and pages that pick a client need the client
 * list. Applied when permissions are saved and again when they are checked.
 */
export const PERMISSION_IMPLIES: Partial<
  Record<PermissionKey, PermissionKey[]>
> = {
  manage_clients: ['view_clients'],
  manage_documents: ['view_documents'],
  view_reports: ['view_clients'],
  manage_reports: ['view_reports', 'view_clients'],
  send_reminders: ['view_clients'],
  manage_whatsapp: ['view_clients'],
};

export function expandPermissions(keys: readonly string[]): string[] {
  const out = new Set(keys);
  for (const key of keys) {
    for (const implied of PERMISSION_IMPLIES[key as PermissionKey] ?? []) {
      out.add(implied);
    }
  }
  return [...out];
}

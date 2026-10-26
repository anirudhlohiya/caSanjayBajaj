import { Admin } from './admin.entity';
import { AuditLog } from './audit-log.entity';
import { BlogPost } from './blog-post.entity';
import { ClientCertificate } from './client-certificate.entity';
import { ClientPreRegistration } from './client-pre-registration.entity';
import { ComplianceTask } from './compliance-task.entity';
import { DeviceToken } from './device-token.entity';
import { Document } from './document.entity';
import { GstFilingPeriod } from './gst-filing-period.entity';
import { Lead } from './lead.entity';
import { OtpVerification } from './otp-verification.entity';
import { Permission } from './permission.entity';
import { RefreshToken } from './refresh-token.entity';
import { Reminder } from './reminder.entity';
import { Report } from './report.entity';
import { ReportNotification } from './report-notification.entity';
import { ReportRequest } from './report-request.entity';
import { ReportShareLink } from './report-share-link.entity';
import { Service } from './service.entity';
import { AppSetting } from './app-setting.entity';
import { DueDate } from './due-date.entity';
import { FamilyMember } from './family-member.entity';
import { Faq } from './faq.entity';
import { Ticket } from './ticket.entity';
import { TicketMessage } from './ticket-message.entity';
import { TicketAttachment } from './ticket-attachment.entity';
import { User } from './user.entity';
import { RentAgreement } from './rent-agreement.entity';
import { WhatsappConversation } from './whatsapp-conversation.entity';
import { WhatsappMessage } from './whatsapp-message.entity';
import {
  ServiceRequest,
  ServiceRequestPayload,
} from './service-request.entity';
import { ItrReturn } from './itr-return.entity';

export const entities = [
  User,
  Admin,
  Permission,
  GstFilingPeriod,
  Document,
  Report,
  Reminder,
  AuditLog,
  RefreshToken,
  DeviceToken,
  ReportNotification,
  ReportRequest,
  ReportShareLink,
  OtpVerification,
  BlogPost,
  Lead,
  ClientPreRegistration,
  Service,
  AppSetting,
  DueDate,
  FamilyMember,
  Faq,
  Ticket,
  TicketMessage,
  TicketAttachment,
  RentAgreement,
  ComplianceTask,
  ClientCertificate,
  WhatsappConversation,
  WhatsappMessage,
  ServiceRequest,
  ItrReturn,
];

export {
  Admin,
  AuditLog,
  BlogPost,
  ClientCertificate,
  ClientPreRegistration,
  ComplianceTask,
  DeviceToken,
  Document,
  GstFilingPeriod,
  ItrReturn,
  Lead,
  OtpVerification,
  Permission,
  RefreshToken,
  Reminder,
  Report,
  ReportNotification,
  ReportRequest,
  ReportShareLink,
  Service,
  AppSetting,
  DueDate,
  FamilyMember,
  Faq,
  ServiceRequest,
  Ticket,
  TicketMessage,
  TicketAttachment,
  RentAgreement,
  User,
  WhatsappConversation,
  WhatsappMessage,
};

export type { ServiceRequestPayload };

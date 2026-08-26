import { Admin } from './admin.entity';
import { AuditLog } from './audit-log.entity';
import { BlogPost } from './blog-post.entity';
import { ClientPreRegistration } from './client-pre-registration.entity';
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
import { Service } from './service.entity';
import { Ticket } from './ticket.entity';
import { TicketMessage } from './ticket-message.entity';
import { TicketAttachment } from './ticket-attachment.entity';
import { User } from './user.entity';

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
  OtpVerification,
  BlogPost,
  Lead,
  ClientPreRegistration,
  Service,
  Ticket,
  TicketMessage,
  TicketAttachment,
];

export {
  Admin,
  AuditLog,
  BlogPost,
  ClientPreRegistration,
  DeviceToken,
  Document,
  GstFilingPeriod,
  Lead,
  OtpVerification,
  Permission,
  RefreshToken,
  Reminder,
  Report,
  ReportNotification,
  Service,
  Ticket,
  TicketMessage,
  TicketAttachment,
  User,
};

import { Admin } from './admin.entity';
import { AuditLog } from './audit-log.entity';
import { DeviceToken } from './device-token.entity';
import { Document } from './document.entity';
import { GstFilingPeriod } from './gst-filing-period.entity';
import { Permission } from './permission.entity';
import { RefreshToken } from './refresh-token.entity';
import { Reminder } from './reminder.entity';
import { Report } from './report.entity';
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
];

export {
  Admin,
  AuditLog,
  DeviceToken,
  Document,
  GstFilingPeriod,
  Permission,
  RefreshToken,
  Reminder,
  Report,
  User,
};

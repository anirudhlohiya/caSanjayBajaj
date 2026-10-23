import { ForbiddenException } from '@nestjs/common';
import { UserType } from '../enums';

/**
 * Which services a client has, by account type. GST work (compliance tasks,
 * reports, GST/Udyam certificates, GST reminders) needs `gst` or `both`; ITR
 * work (ITR returns, family members) needs `itr` or `both`. `general` (and the
 * legacy `normal`) have neither. Downgrading never deletes data — the actions
 * are just refused until the service is active again.
 */
export function hasGstService(type: UserType | null | undefined): boolean {
  return type === UserType.GST || type === UserType.BOTH;
}

export function hasItrService(type: UserType | null | undefined): boolean {
  return type === UserType.ITR || type === UserType.BOTH;
}

export function assertGstClient(user: { user_type: UserType }): void {
  if (!hasGstService(user.user_type)) {
    throw new ForbiddenException('GST services are not active for this client');
  }
}

export function assertItrClient(user: { user_type: UserType }): void {
  if (!hasItrService(user.user_type)) {
    throw new ForbiddenException('ITR services are not active for this client');
  }
}

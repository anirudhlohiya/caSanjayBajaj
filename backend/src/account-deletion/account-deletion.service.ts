import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { DataSource, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { SubjectType, UserStatus } from '../common/enums';
import { User } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ServicesOfferedService } from '../services-offered/services-offered.service';
import { StorageService } from '../storage/storage.service';

export const DELETION_GRACE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ] as string,
  );

/**
 * Client self-service account deletion.
 *
 * request → the account is locked (status inactive, sessions and devices
 * dropped) and the firm is emailed. Signing in again within
 * DELETION_GRACE_DAYS cancels it (AuthService.loginUser).
 *
 * After the grace period a daily job erases the login and personal details
 * (email, phone, date of birth, photo, password) plus support tickets,
 * reminders, notification history and WhatsApp chats. Tax records stay for
 * the firm: name, PAN, GSTIN, business name, family members, filings,
 * documents, reports and certificates.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly firm: ServicesOfferedService,
  ) {}

  static deleteAfter(requestedAt: Date): Date {
    return new Date(requestedAt.getTime() + DELETION_GRACE_DAYS * DAY_MS);
  }

  async request(
    userId: string,
    password: string,
  ): Promise<{ delete_after: string }> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.password_hash')
      .where('user.id = :id', { id: userId })
      .getOne();
    if (!user || user.deleted_at) throw new NotFoundException('User not found');
    if (!password || !(await argon2.verify(user.password_hash, password))) {
      throw new ForbiddenException('Password is incorrect');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Account is not active');
    }

    const requestedAt = new Date();
    await this.dataSource.transaction(async (m) => {
      await m.update(User, user.id, {
        status: UserStatus.INACTIVE,
        deletion_requested_at: requestedAt,
      });
      // Sign out everywhere and stop push alerts
      await m.query(
        `UPDATE "refresh_tokens" SET "revoked_at" = now()
         WHERE "subject_type" = $1 AND "subject_id" = $2 AND "revoked_at" IS NULL`,
        [SubjectType.USER, user.id],
      );
      await m.query(`DELETE FROM "device_tokens" WHERE "user_id" = $1`, [
        user.id,
      ]);
    });
    await this.audit.log(
      null,
      'user.deletion_requested',
      {},
      {
        user_id: user.id,
      },
    );

    const deleteAfter = AccountDeletionService.deleteAfter(requestedAt);
    await this.emailFirm(user, deleteAfter);
    return { delete_after: deleteAfter.toISOString() };
  }

  /** Called on sign-in: a pending deletion is cancelled and the account reopened. */
  async cancelIfPending(user: User): Promise<boolean> {
    if (
      user.status !== UserStatus.INACTIVE ||
      !user.deletion_requested_at ||
      user.deleted_at
    ) {
      return false;
    }
    await this.users.update(user.id, {
      status: UserStatus.ACTIVE,
      deletion_requested_at: null,
    });
    user.status = UserStatus.ACTIVE;
    user.deletion_requested_at = null;
    await this.audit.log(
      null,
      'user.deletion_cancelled',
      {},
      {
        user_id: user.id,
      },
    );
    return true;
  }

  @Cron('30 2 * * *', { timeZone: 'Asia/Kolkata' })
  async eraseDue(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - DELETION_GRACE_DAYS * DAY_MS);
    const due = await this.users.find({
      where: {
        status: UserStatus.INACTIVE,
        deletion_requested_at: LessThanOrEqual(cutoff),
        deleted_at: IsNull(),
      },
    });
    let erased = 0;
    for (const user of due) {
      try {
        await this.erase(user);
        erased++;
      } catch (err) {
        this.logger.error(
          `Erasing account ${user.id} failed: ${(err as Error).message}`,
        );
      }
    }
    if (erased) this.logger.log(`Erased ${erased} deleted account(s)`);
    return erased;
  }

  async erase(user: User): Promise<void> {
    const files: string[] = [];
    await this.dataSource.transaction(async (m) => {
      const attachments: { s3_key: string }[] = await m.query(
        `SELECT a."s3_key" FROM "ticket_attachments" a
           JOIN "ticket_messages" msg ON msg."id" = a."ticket_message_id"
           JOIN "tickets" t ON t."id" = msg."ticket_id"
         WHERE t."user_id" = $1`,
        [user.id],
      );
      files.push(...attachments.map((a) => a.s3_key));
      if (user.profile_photo_url) files.push(user.profile_photo_url);

      // Support chats, reminders, notification history, devices, sessions
      await m.query(`DELETE FROM "tickets" WHERE "user_id" = $1`, [user.id]);
      await m.query(`DELETE FROM "reminders" WHERE "user_id" = $1`, [user.id]);
      await m.query(`DELETE FROM "report_notifications" WHERE "user_id" = $1`, [
        user.id,
      ]);
      await m.query(`DELETE FROM "device_tokens" WHERE "user_id" = $1`, [
        user.id,
      ]);
      await m.query(
        `DELETE FROM "whatsapp_conversations" WHERE "client_id" = $1`,
        [user.id],
      );
      await m.query(
        `DELETE FROM "refresh_tokens" WHERE "subject_type" = $1 AND "subject_id" = $2`,
        [SubjectType.USER, user.id],
      );
      await m.query(
        `DELETE FROM "otp_verifications" WHERE LOWER("email") = LOWER($1)`,
        [user.email],
      );

      // Login and personal details; name / PAN / GSTIN / business stay
      await m.update(User, user.id, {
        email: `deleted-${user.id}@deleted.invalid`,
        password_hash: await argon2.hash(randomBytes(32).toString('hex')),
        phone: null,
        dob: null,
        profile_photo_url: null,
        email_suppressed_at: null,
        deleted_at: new Date(),
      });
    });
    await this.audit.log(null, 'user.deleted', {}, { user_id: user.id });

    // Stored files go after the commit; a failure only leaves an orphan object
    for (const key of files) {
      await this.storage
        .deleteObject(key)
        .catch((err: Error) =>
          this.logger.warn(`Could not delete ${key}: ${err.message}`),
        );
    }
  }

  private async emailFirm(user: User, deleteAfter: Date): Promise<void> {
    try {
      const { email } = await this.firm.getContact();
      if (!email) return;
      const when = deleteAfter.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
      const ids = [
        user.pan && `PAN ${user.pan}`,
        user.gstin && `GSTIN ${user.gstin}`,
      ]
        .filter(Boolean)
        .join(', ');
      await this.notifications.sendEmail(
        { email, name: 'S N Bajaj And Co' },
        `Account deletion requested: ${user.name}`,
        `<p><strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.email)}${ids ? `, ${escapeHtml(ids)}` : ''}) asked to delete their app account.</p>
<p>Their login, email, phone, date of birth and photo will be erased on <strong>${when}</strong>, along with support tickets, reminders and notifications. Filings, documents, reports, certificates and family members are kept.</p>
<p>If they sign in again before then, the deletion is cancelled.</p>`,
      );
    } catch (err) {
      this.logger.warn(
        `Could not email the firm about deletion of ${user.id}: ${(err as Error).message}`,
      );
    }
  }
}

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { paginate, PaginatedResult } from '../common/dto/pagination';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { Report } from '../entities/report.entity';
import {
  NotificationsService,
  isPushSubscription,
} from '../notifications/notifications.service';
import { ReportNotificationsService } from '../notifications/report-notifications.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { CreateReportDto, ReportFilterQueryDto } from './dto/report.dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  constructor(
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(GstFilingPeriod)
    private readonly periods: Repository<GstFilingPeriod>,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly reportNotifications: ReportNotificationsService,
    private readonly usersService: UsersService,
  ) {}

  async upload(auth: AuthUser, dto: CreateReportDto) {
    const period = await this.periods.findOneBy({ id: dto.filing_period_id });
    if (!period) throw new NotFoundException('Filing period not found');

    const { uploadUrl, s3Key } = await this.storage.createUploadUrl(
      'reports',
      dto.user_id,
      period.period_code,
      dto.filename,
      dto.contentType,
    );

    // Report record is created immediately; the caller uploads bytes to S3 directly.
    const report = await this.reports.save(
      this.reports.create({
        user_id: dto.user_id,
        filing_period_id: period.id,
        report_type: dto.report_type,
        s3_key: s3Key,
        original_filename: dto.filename,
        sent_by_admin_id: auth.type === 'admin' ? auth.sub : null,
      }),
    );

    return {
      report_id: report.id,
      upload_url: uploadUrl,
      expires_in: 300,
    };
  }

  async confirmAndNotify(reportId: string) {
    const report = await this.reports.findOneBy({ id: reportId });
    if (!report) throw new NotFoundException('Report not found');

    const user = await this.usersService.findOne(report.user_id);
    const period = await this.periods.findOneBy({
      id: report.filing_period_id,
    });

    const reportUrl = `${process.env.API_BASE_URL ?? ''}/reports/${report.id}`;
    const title = 'Your GST report is ready';
    const body = `${period?.period_label ?? 'Your'} ${report.report_type.replace('_', ' ').toUpperCase()} report is ready to view in the app.`;
    const deepLink = '/reports';

    // Persist the in-app notification immediately so it is never lost.
    await this.reportNotifications.record(user.id, title, body, deepLink);

    // Deliver push + email in the background so the confirm request returns
    // immediately (avoids nginx read timeout 504 when the network is slow).
    void this.deliverReportNotifications(report, user, reportUrl, title, body);

    return report;
  }

  private async deliverReportNotifications(
    report: { id: string; user_id: string; report_type: string },
    user: { id: string; email: string; name: string },
    reportUrl: string,
    title: string,
    body: string,
  ): Promise<void> {
    try {
      const pushTargets = await this.usersService.getTokensForPush(
        report.user_id,
      );
      for (const token of pushTargets) {
        let subscription: unknown;
        try {
          subscription = JSON.parse(token.push_token);
        } catch {
          subscription = null;
        }
        if (isPushSubscription(subscription)) {
          try {
            await this.notifications.sendPush(subscription, {
              title,
              body,
              url: reportUrl,
            });
          } catch {
            /* keep delivering to remaining tokens + email */
          }
        }
      }

      await this.notifications.sendEmail(
        { email: user.email, name: user.name },
        title,
        `<p>Dear ${user.name},</p><p>${body}</p><p><a href="${reportUrl}">Open report in the app</a></p>`,
      );
    } catch (error) {
      this.logger.warn(
        `Report notification delivery failed for ${report.user_id}: ${(error as Error).message}`,
      );
    }
  }

  async listForUser(
    auth: AuthUser,
    targetUserId: string,
    query: ReportFilterQueryDto,
  ): Promise<PaginatedResult<Report>> {
    if (auth.type === 'user' && auth.sub !== targetUserId) {
      throw new ForbiddenException('Cannot access another user reports');
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const qb = this.reports
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.filing_period', 'period')
      .leftJoinAndSelect('report.sent_by_admin', 'admin')
      .where('report.user_id = :uid', { uid: targetUserId })
      .orderBy('report.sent_at', 'DESC');

    if (query.filing_period_id)
      qb.andWhere('report.filing_period_id = :pid', {
        pid: query.filing_period_id,
      });
    if (query.report_type)
      qb.andWhere('report.report_type = :type', { type: query.report_type });

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return paginate(items, total, page, pageSize);
  }

  async adminList(
    query: ReportFilterQueryDto,
  ): Promise<PaginatedResult<Report>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const qb = this.reports
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.user', 'user')
      .leftJoinAndSelect('report.filing_period', 'period')
      .orderBy('report.sent_at', 'DESC');

    if (query.filing_period_id)
      qb.andWhere('report.filing_period_id = :pid', {
        pid: query.filing_period_id,
      });
    if (query.report_type)
      qb.andWhere('report.report_type = :type', { type: query.report_type });

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return paginate(items, total, page, pageSize);
  }

  async downloadUrl(
    auth: AuthUser,
    reportId: string,
  ): Promise<{ download_url: string }> {
    const report = await this.reports.findOneBy({ id: reportId });
    if (!report) throw new NotFoundException('Report not found');
    if (auth.type === 'user' && auth.sub !== report.user_id) {
      throw new ForbiddenException('Cannot access another user report');
    }
    const url = await this.storage.createDownloadUrl(report.s3_key);
    return { download_url: url };
  }
}

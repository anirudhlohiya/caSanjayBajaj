import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate, PaginatedResult } from '../common/dto/pagination';
import { ReportNotification } from '../entities/report-notification.entity';
import { NotificationQueryDto } from './dto/notification.dto';

@Injectable()
export class ReportNotificationsService {
  constructor(
    @InjectRepository(ReportNotification)
    private readonly notifications: Repository<ReportNotification>,
  ) {}

  async record(
    userId: string,
    title: string,
    body: string,
    deepLink?: string,
  ): Promise<ReportNotification> {
    return this.notifications.save(
      this.notifications.create({
        user_id: userId,
        title,
        body,
        deep_link: deepLink ?? null,
      }),
    );
  }

  async list(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<PaginatedResult<ReportNotification>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Record<string, unknown> = { user_id: userId };
    if (query.unread_only) where.is_read = false;

    const [items, total] = await this.notifications.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return paginate(items, total, page, pageSize);
  }

  async markAllRead(userId: string): Promise<{ success: boolean }> {
    await this.notifications.update(
      { user_id: userId, is_read: false },
      { is_read: true },
    );
    return { success: true };
  }

  async markRead(userId: string, id: string): Promise<ReportNotification> {
    const notification = await this.notifications.findOneBy({ id });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.user_id !== userId) {
      throw new NotFoundException('Notification not found');
    }
    notification.is_read = true;
    return this.notifications.save(notification);
  }
}

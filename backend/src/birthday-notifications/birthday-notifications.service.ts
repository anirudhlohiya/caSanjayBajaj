import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import { User } from '../entities/user.entity';
import {
  NotificationsService,
  isPushSubscription,
} from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class BirthdayNotificationsService {
  private readonly logger = new Logger(BirthdayNotificationsService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly notifications: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  @Cron('1 0 * * *', { timeZone: 'Asia/Kolkata' })
  async sendBirthdayMorning(): Promise<void> {
    await this.sendBirthdayWishes('morning');
  }

  @Cron('59 23 * * *', { timeZone: 'Asia/Kolkata' })
  async sendBirthdayEvening(): Promise<void> {
    await this.sendBirthdayWishes('evening');
  }

  private async sendBirthdayWishes(
    timeOfDay: 'morning' | 'evening',
  ): Promise<void> {
    try {
      const today = new Date();
      const users = await this.users.find({
        where: {
          dob: Raw(
            (alias) =>
              `EXTRACT(MONTH FROM ${alias}) = :month AND EXTRACT(DAY FROM ${alias}) = :day`,
            {
              month: today.getMonth() + 1,
              day: today.getDate(),
            },
          ),
        },
      });

      if (users.length === 0) return;

      for (const user of users) {
        const firstName = user.name ? user.name.split(' ')[0] : 'there';
        const subject = 'S N Bajaj And Co — Happy Birthday!';
        const greeting =
          timeOfDay === 'morning'
            ? 'Wishing you the very best on your special day, today and always!'
            : 'We hope your birthday ended as wonderfully as it began. Happy Birthday once again!';
        const htmlBody = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
            'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
            sans-serif; padding: 20px; color: #191c1e; background-color: #f7f9fb;">
            <h2 style="color: #001433;">S N BAJAJ AND CO</h2>
            <p>Dear ${firstName},</p>
            <p>Happy Birthday!</p>
            <p>${greeting}</p>
            <p>From all of us at S N Bajaj And Co, we wish you a year filled with health, happiness, and success.</p>
            <p style="font-size: 13px; color: #74777f; margin-top: 20px;">
              S N Bajaj And Co
            </p>
          </div>
        `;
        await this.notifications.sendEmail(
          { email: user.email },
          subject,
          htmlBody,
        );

        const pushTokens = await this.usersService.getTokensForPush(user.id);
        for (const token of pushTokens) {
          let subscription: unknown;
          try {
            subscription = JSON.parse(token.push_token);
          } catch {
            subscription = null;
          }
          if (isPushSubscription(subscription)) {
            await this.notifications.sendPush(subscription, {
              title: subject,
              body: greeting,
              url: '/',
            });
          }
        }
      }
      this.logger.log(`Sent ${users.length} birthday wishes (${timeOfDay})`);
    } catch (error) {
      this.logger.error(
        `Failed to send birthday wishes: ${(error as Error).message}`,
      );
    }
  }
}

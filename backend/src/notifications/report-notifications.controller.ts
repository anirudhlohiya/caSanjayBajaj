import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationQueryDto } from './dto/notification.dto';
import { ReportNotificationsService } from './report-notifications.service';

@ApiTags('notifications (client)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/notifications')
export class ReportNotificationsController {
  constructor(
    private readonly reportNotifications: ReportNotificationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List own notifications (client)' })
  list(@CurrentUser() auth: AuthUser, @Query() query: NotificationQueryDto) {
    return this.reportNotifications.list(auth.sub, query);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all own notifications as read' })
  markAllRead(@CurrentUser() auth: AuthUser) {
    return this.reportNotifications.markAllRead(auth.sub);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a single notification as read' })
  markRead(@CurrentUser() auth: AuthUser, @Param('id') id: string) {
    return this.reportNotifications.markRead(auth.sub, id);
  }
}

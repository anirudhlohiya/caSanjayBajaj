import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard, RolesGuard } from '../common/guards/roles.guard';
import { ReminderLogQueryDto, SendReminderDto } from './dto/reminder.dto';
import { RemindersService } from './reminders.service';

@ApiTags('reminders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Permissions('send_reminders')
@Controller('admin/reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually send reminders (single client or all unfiled)',
  })
  send(@CurrentUser() auth: AuthUser, @Body() dto: SendReminderDto) {
    return this.remindersService.sendReminder(auth, dto);
  }

  @Get('log')
  @ApiOperation({ summary: 'Reminder send log (auto + manual)' })
  log(@Query() query: ReminderLogQueryDto) {
    return this.remindersService.log(query);
  }
}

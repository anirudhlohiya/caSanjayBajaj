import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ComplianceTasksService } from './compliance-tasks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { TaskStatus } from '../common/enums';

@Controller('compliance-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplianceTasksController {
  constructor(private readonly tasksService: ComplianceTasksService) {}

  @Get()
  async getClientTasks(
    @CurrentUser() user: AuthUser,
    @Query('periodId') periodId: string,
  ) {
    return this.tasksService.listForClient(user.sub, periodId);
  }

  @Post('auto-generate')
  async autoGenerateTasks(
    @CurrentUser() user: AuthUser,
    @Body('periodId') periodId: string,
  ) {
    // Compatibility entry point: task sets are now generated per the user's
    // stored cadence (gst_filing_frequency), so isQuarterly is ignored.
    return this.tasksService.ensureTasksForPeriod(user.sub, periodId);
  }

  /** Client-initiated nil filing (docs/13 §3.5 / §6.5). */
  @Post(':id/nil')
  async declareNil(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasksService.markNil(id, user.sub);
  }

  /** Admin pending-nil queue (docs/13 §6.5). */
  @Roles('super_admin', 'staff')
  @Get('admin/nil-pending')
  async nilPending() {
    return this.tasksService.pendingNilFilings();
  }

  /** Admin confirms a nil filing → task completed (docs/13 §3.5). */
  @Roles('super_admin', 'staff')
  @Patch('admin/:id/nil-confirm')
  async confirmNil(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasksService.confirmNil(id, user.sub);
  }

  @Roles('super_admin', 'staff')
  @Get('admin/client/:clientId')
  async getAdminClientTasks(
    @Param('clientId') clientId: string,
    @Query('periodId') periodId: string,
  ) {
    return this.tasksService.listForClient(clientId, periodId);
  }

  @Roles('super_admin', 'staff')
  @Post('admin/client/:clientId/auto-generate')
  async adminAutoGenerateTasks(
    @Param('clientId') clientId: string,
    @Body('periodId') periodId: string,
  ) {
    return this.tasksService.ensureTasksForPeriod(clientId, periodId);
  }

  @Roles('super_admin', 'staff')
  @Patch('admin/:id/payment')
  async updatePayment(
    @Param('id') id: string,
    @Body('amount') amount: string,
    @Body('paidAt') paidAt: string,
  ) {
    return this.tasksService.updatePayment(
      id,
      amount,
      paidAt ? new Date(paidAt) : null,
    );
  }

  @Roles('super_admin', 'staff')
  @Patch('admin/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: TaskStatus,
  ) {
    return this.tasksService.updateStatus(id, status);
  }
}

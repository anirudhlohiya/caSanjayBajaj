import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/permissions.decorator';
import { AdminRole } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminDashboardService } from './admin-dashboard.service';

@ApiTags('admin dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.STAFF)
@Controller('admin')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current admin profile' })
  me(@CurrentUser() auth: AuthUser) {
    return this.dashboard.me(auth.sub);
  }

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Dashboard KPI statistics' })
  stats() {
    return this.dashboard.getStats();
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
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
import { CreateReportDto, ReportFilterQueryDto } from './dto/report.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // Client: own reports
  @Get('me/reports')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List own reports (client)' })
  myReports(
    @CurrentUser() auth: AuthUser,
    @Query() query: ReportFilterQueryDto,
  ) {
    return this.reportsService.listForUser(auth, auth.sub, query);
  }

  @Get('me/reports/:id/download-url')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Signed download URL for own report (client)' })
  myReportDownload(@CurrentUser() auth: AuthUser, @Param('id') id: string) {
    return this.reportsService.downloadUrl(auth, id);
  }

  // Admin: upload a report (creates record + returns upload URL)
  @Post('admin/reports')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('upload_reports')
  @ApiOperation({
    summary: 'Initiate report upload (admin); get pre-signed PUT URL',
  })
  upload(@CurrentUser() auth: AuthUser, @Body() dto: CreateReportDto) {
    return this.reportsService.upload(auth, dto);
  }

  // Admin: confirm report upload and fire notifications
  @Post('admin/reports/:id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('upload_reports')
  @ApiOperation({
    summary: 'Confirm report upload; deliver push + email to client',
  })
  confirm(@Param('id') id: string) {
    return this.reportsService.confirmAndNotify(id);
  }

  @Get('admin/users/:userId/reports')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('upload_reports')
  @ApiOperation({ summary: 'List a client reports (admin)' })
  userReports(
    @CurrentUser() auth: AuthUser,
    @Param('userId') userId: string,
    @Query() query: ReportFilterQueryDto,
  ) {
    return this.reportsService.listForUser(auth, userId, query);
  }

  @Get('admin/reports')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('upload_reports')
  @ApiOperation({ summary: 'List reports across clients (admin)' })
  adminList(@Query() query: ReportFilterQueryDto) {
    return this.reportsService.adminList(query);
  }

  @Get('admin/reports/:id/download-url')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('upload_reports')
  @ApiOperation({ summary: 'Signed download URL for a report (admin)' })
  adminReportDownload(@CurrentUser() auth: AuthUser, @Param('id') id: string) {
    return this.reportsService.downloadUrl(auth, id);
  }
}

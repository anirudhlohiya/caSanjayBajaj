import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard, RolesGuard } from '../common/guards/roles.guard';
import {
  CreateReportRequestDto,
  FulfillReportRequestDto,
  ReportRequestFilterQueryDto,
} from './dto/report-request.dto';
import { ReportRequestsService } from './report-requests.service';

@ApiTags('report-requests')
@Controller()
export class ReportRequestsController {
  constructor(private readonly service: ReportRequestsService) {}

  // Client: create a report-request for a filing period
  @Post('me/report-requests')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Create a report request for a filing period (client)',
  })
  create(@CurrentUser() auth: AuthUser, @Body() dto: CreateReportRequestDto) {
    return this.service.create(auth, dto);
  }

  // Client: list own requests
  @Get('me/report-requests')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List own report requests (client)' })
  listMine(
    @CurrentUser() auth: AuthUser,
    @Query() query: ReportRequestFilterQueryDto,
  ) {
    return this.service.listMine(auth, query);
  }

  // Admin: queue of all requests
  @Get('admin/report-requests')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('upload_reports')
  @ApiOperation({
    summary: 'List report requests across clients (admin queue)',
  })
  adminList(@Query() query: ReportRequestFilterQueryDto) {
    return this.service.adminList(query);
  }

  // Admin: fulfill a pending request (returns presigned upload URL)
  @Post('admin/report-requests/:id/fulfill')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('upload_reports')
  @ApiOperation({
    summary: 'Fulfill a pending request; returns presigned upload URL',
  })
  fulfill(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Body() dto: FulfillReportRequestDto,
  ) {
    return this.service.fulfill(auth, id, dto);
  }
}

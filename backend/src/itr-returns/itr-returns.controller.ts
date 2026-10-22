import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard, RolesGuard } from '../common/guards/roles.guard';
import {
  ConfirmItrReturnDto,
  CreateItrReturnUploadUrlDto,
} from './dto/itr-return.dto';
import { ItrReturnsService } from './itr-returns.service';

@ApiTags('itr-returns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ItrReturnsController {
  constructor(private readonly itrReturnsService: ItrReturnsService) {}

  @Post('admin/clients/:id/itr-returns/upload-url')
  @Permissions('upload_reports')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @ApiOperation({
    summary: 'Get pre-signed S3 PUT URL for uploading an ITR return PDF',
  })
  uploadUrl(
    @Param('id') clientId: string,
    @Body() dto: CreateItrReturnUploadUrlDto,
  ) {
    return this.itrReturnsService.requestUploadUrl(clientId, dto);
  }

  @Post('admin/clients/:id/itr-returns/confirm')
  @Permissions('upload_reports')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Confirm upload of an ITR return PDF' })
  confirm(
    @CurrentUser() auth: AuthUser,
    @Param('id') clientId: string,
    @Body() dto: ConfirmItrReturnDto,
  ) {
    return this.itrReturnsService.confirm(auth.sub, clientId, dto);
  }

  @Get('admin/clients/:id/itr-returns')
  @Permissions('view_documents')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @ApiOperation({ summary: 'List ITR returns for a client (admin)' })
  listForClient(@Param('id') clientId: string) {
    return this.itrReturnsService.listForAdmin(clientId);
  }

  @Get('me/itr-returns')
  @ApiOperation({ summary: 'List own ITR returns with download URLs (client)' })
  listMine(@CurrentUser() auth: AuthUser) {
    return this.itrReturnsService.listMine(auth.sub);
  }
}

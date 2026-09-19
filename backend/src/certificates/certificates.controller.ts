import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard, RolesGuard } from '../common/guards/roles.guard';
import { CreateCertificateUploadUrlDto } from './dto/certificate.dto';
import { CertificatesService } from './certificates.service';

@ApiTags('certificates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Post('admin/clients/:userId/certificates/upload-url')
  @Permissions('upload_reports')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Get pre-signed S3 PUT URL for a new certificate' })
  uploadUrl(
    @Param('userId') userId: string,
    @Body() dto: CreateCertificateUploadUrlDto,
  ) {
    return this.certificatesService.requestUploadUrl(userId, dto);
  }

  @Post('admin/clients/:userId/certificates/:certId/confirm')
  @Permissions('upload_reports')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Confirm direct S3 upload; certificate goes live' })
  confirm(@CurrentUser() auth: AuthUser, @Param('certId') certId: string) {
    return this.certificatesService.confirm(auth, certId);
  }

  @Get('admin/clients/:userId/certificates')
  @Permissions('view_clients')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @ApiOperation({ summary: 'List a client certificates (admin)' })
  listForClient(@Param('userId') userId: string) {
    return this.certificatesService.listForUser(userId);
  }

  // Client: their own certificates
  @Get('me/certificates')
  @ApiOperation({ summary: 'List own certificates (client)' })
  myCertificates(@CurrentUser() auth: AuthUser) {
    return this.certificatesService.listMine(auth);
  }

  // Client: lifetime download
  @Get('me/certificates/:id/download-url')
  @ApiOperation({ summary: 'Get signed download URL for own certificate' })
  download(@CurrentUser() auth: AuthUser, @Param('id') id: string) {
    return this.certificatesService.downloadUrl(auth, id);
  }
}

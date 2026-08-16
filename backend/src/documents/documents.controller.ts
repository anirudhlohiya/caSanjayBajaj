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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard, RolesGuard } from '../common/guards/roles.guard';
import {
  ConfirmUploadDto,
  CreateUploadUrlDto,
  DocumentStatusQueryDto,
} from './dto/document.dto';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // Client (and admin) initiate a direct-to-S3 upload
  @Post('documents/upload-url')
  @ApiOperation({ summary: 'Get pre-signed S3 PUT URL + document id' })
  requestUploadUrl(
    @CurrentUser() auth: AuthUser,
    @Body() dto: CreateUploadUrlDto,
  ) {
    return this.documentsService.requestUploadUrl(auth, dto);
  }

  @Post('documents/:id/confirm')
  @ApiOperation({ summary: 'Confirm direct S3 upload; mark document received' })
  confirm(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Body() dto: ConfirmUploadDto,
  ) {
    return this.documentsService.confirmUpload(auth, id, dto);
  }

  @Get('documents/:id/download-url')
  @ApiOperation({ summary: 'Get short-lived signed download URL' })
  download(@CurrentUser() auth: AuthUser, @Param('id') id: string) {
    return this.documentsService.downloadUrl(auth, id);
  }

  // Client: their own documents
  @Get('me/documents')
  @ApiOperation({ summary: 'List own documents (client)' })
  myDocuments(
    @CurrentUser() auth: AuthUser,
    @Query() query: DocumentStatusQueryDto,
  ) {
    return this.documentsService.listForUser(auth, auth.sub, query);
  }

  // Admin: documents of a specific client
  @Get('admin/users/:userId/documents')
  @Permissions('view_documents')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @ApiOperation({ summary: 'List a client documents (admin)' })
  userDocuments(
    @CurrentUser() auth: AuthUser,
    @Param('userId') userId: string,
    @Query() query: DocumentStatusQueryDto,
  ) {
    return this.documentsService.listForUser(auth, userId, query);
  }

  // Admin: cross-client document list
  @Get('admin/documents')
  @Permissions('view_documents')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @ApiOperation({ summary: 'List documents across clients (admin)' })
  adminList(@Query() query: DocumentStatusQueryDto) {
    return this.documentsService.adminList(query);
  }

  @Patch('admin/documents/:id/processed')
  @Permissions('view_documents')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Mark a document as processed (admin)' })
  markProcessed(@CurrentUser() auth: AuthUser, @Param('id') id: string) {
    return this.documentsService.markProcessed(auth, id);
  }
}

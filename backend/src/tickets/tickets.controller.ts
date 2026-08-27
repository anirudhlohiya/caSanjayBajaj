import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard, RolesGuard } from '../common/guards/roles.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination';
import { TicketsService } from './tickets.service';
import {
  CreateTicketDto,
  CreateTicketMessageDto,
  UpdateTicketStatusDto,
  TicketAttachmentUploadDto,
} from './dto/ticket.dto';

@ApiTags('tickets (client)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('me/tickets')
export class ClientTicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @ApiOperation({ summary: 'List my tickets' })
  list(@CurrentUser() user: any, @Query() query: PaginationQueryDto & { status?: string }) {
    return this.ticketsService.listForUser(user.sub, query);
  }

  @Post('attachment-upload-url')
  @ApiOperation({ summary: 'Get presigned URL for attachment upload' })
  attachmentUploadUrl(
    @CurrentUser() user: any,
    @Body() dto: TicketAttachmentUploadDto,
  ) {
    return this.ticketsService.createAttachmentUrlForUser(
      dto.message_id,
      user.sub,
      dto,
    );
  }

  @Post('attachments/:attachmentId/download-url')
  @ApiOperation({ summary: 'Get presigned download URL for an attachment' })
  attachmentDownloadUrl(
    @CurrentUser() user: any,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.ticketsService.getAttachmentDownloadUrlForUser(
      attachmentId,
      user.sub,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket detail' })
  get(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.findOneForUser(id, user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Create a ticket' })
  create(@CurrentUser() user: any, @Body() dto: CreateTicketDto) {
    return this.ticketsService.createForUser(user.sub, dto);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Reply to a ticket' })
  reply(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTicketMessageDto,
  ) {
    return this.ticketsService.addMessageForUser(id, user.sub, dto);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close a ticket' })
  close(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.closeForUser(id, user.sub);
  }
}

@ApiTags('tickets (admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('admin/tickets')
export class AdminTicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @Permissions('view_clients')
  @ApiOperation({ summary: 'List all tickets' })
  list(@Query() query: PaginationQueryDto & { status?: string; user_id?: string }) {
    return this.ticketsService.listAll(query);
  }

  @Get(':id')
  @Permissions('view_clients')
  @ApiOperation({ summary: 'Get ticket detail with messages' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.findOneAdmin(id);
  }

  @Post(':id/messages')
  @Permissions('view_clients')
  @ApiOperation({ summary: 'Reply to a ticket as admin' })
  reply(
    @CurrentUser() admin: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTicketMessageDto,
  ) {
    return this.ticketsService.addMessageForAdmin(id, admin.sub, dto);
  }

  @Patch(':id/status')
  @Permissions('view_clients')
  @ApiOperation({ summary: 'Update ticket status' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.ticketsService.updateStatus(id, dto.status);
  }

  @Post('attachments/:attachmentId/download-url')
  @Permissions('view_clients')
  @ApiOperation({ summary: 'Get presigned download URL for an attachment' })
  attachmentDownloadUrl(
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.ticketsService.getAttachmentDownloadUrl(attachmentId);
  }
}

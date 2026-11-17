import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Sse,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Observable, concatMap, map, takeWhile } from 'rxjs';
import { DataSource } from 'typeorm';
import {
  JwtAuthGuard,
  refreshAdminAccess,
} from '../common/guards/jwt-auth.guard';
import { adminCan, PermissionsGuard } from '../common/guards/roles.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateIf,
} from 'class-validator';
import { AuditService } from '../audit/audit.service';
import {
  WhatsappChatsService,
  UpdateConversationDto,
} from './whatsapp-chats.service';
import { WhatsappEventsService } from './whatsapp-events.service';

class SendStaffMessageDto {
  @IsString()
  @IsNotEmpty()
  body: string;
}

class SendTemplateDto {
  @IsString()
  @IsNotEmpty()
  template: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Length(1, 500, { each: true })
  @IsOptional()
  params?: string[];
}

class StartTemplateConversationDto extends SendTemplateDto {
  @ValidateIf((o: StartTemplateConversationDto) => !o.phone)
  @IsUUID()
  client_id?: string;

  @ValidateIf((o: StartTemplateConversationDto) => !o.client_id)
  @IsString()
  @Length(10, 16)
  phone?: string;
}

class UpdateMetadataDto implements UpdateConversationDto {
  @IsString()
  @IsOptional()
  clientName?: string;

  @IsString()
  @IsOptional()
  businessName?: string;

  @IsString()
  @IsOptional()
  gstin?: string;

  @IsBoolean()
  @IsOptional()
  verified?: boolean;

  @IsString()
  @IsOptional()
  internalNotes?: string;
}

@ApiTags('whatsapp-chats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('whatsapp-chats')
export class WhatsappChatsController {
  constructor(
    private readonly chatsService: WhatsappChatsService,
    private readonly eventsService: WhatsappEventsService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  @Get('conversations')
  @Permissions('manage_whatsapp')
  @ApiOperation({ summary: 'List WhatsApp conversations' })
  async listConversations(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatsService.listConversations({
      status,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('templates')
  @Permissions('manage_whatsapp')
  @ApiOperation({ summary: 'Approved WhatsApp templates for staff messages' })
  async listTemplates() {
    return this.chatsService.listTemplates();
  }

  @Post('conversations/start')
  @Permissions('manage_whatsapp')
  @ApiOperation({
    summary: 'Start a conversation with an approved template (client or phone)',
  })
  async startConversation(
    @Body() body: StartTemplateConversationDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.chatsService.startWithTemplate(
      { client_id: body.client_id, phone: body.phone },
      body,
      user.sub,
    );
    await this.audit.log(
      user.sub,
      'whatsapp.template_sent',
      { template: body.template, conversation_id: result.conversation.id },
      { user_id: result.conversation.clientId ?? undefined },
    );
    return result;
  }

  @Post('conversations/:id/template')
  @Permissions('manage_whatsapp')
  @ApiOperation({
    summary: 'Send an approved template in an existing conversation',
  })
  async sendTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendTemplateDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.chatsService.startWithTemplate(
      { conversation_id: id },
      body,
      user.sub,
    );
    await this.audit.log(
      user.sub,
      'whatsapp.template_sent',
      { template: body.template, conversation_id: id },
      { user_id: result.conversation.clientId ?? undefined },
    );
    return result;
  }

  @Get('usage')
  @Permissions('manage_whatsapp')
  @ApiOperation({ summary: 'Get monthly WhatsApp usage vs 1,000 free tier' })
  async getUsage() {
    return this.chatsService.getMonthlyUsageStats();
  }

  @Get('conversations/:id/messages')
  @Permissions('manage_whatsapp')
  @ApiOperation({ summary: 'Get messages for a conversation' })
  async getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.chatsService.getMessages(
      id,
      limit ? parseInt(limit, 10) : 200,
      before,
    );
  }

  @Post('conversations/:id/messages')
  @Permissions('manage_whatsapp')
  @ApiOperation({ summary: 'Staff sends a message via WhatsApp Cloud API' })
  async sendStaffMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendStaffMessageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.chatsService.sendStaffMessage(id, body.body, user.sub);
  }

  @Patch('conversations/:id/takeover')
  @Permissions('manage_whatsapp')
  @ApiOperation({ summary: 'Staff takes over the conversation' })
  async takeover(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.chatsService.takeover(id, user.sub);
  }

  @Patch('conversations/:id/release')
  @Permissions('manage_whatsapp')
  @ApiOperation({ summary: 'Hand back conversation to AI' })
  async release(@Param('id', ParseUUIDPipe) id: string) {
    return this.chatsService.release(id);
  }

  @Patch('conversations/:id/escalate')
  @Permissions('manage_whatsapp')
  @ApiOperation({ summary: 'Escalate conversation' })
  async escalate(@Param('id', ParseUUIDPipe) id: string) {
    return this.chatsService.setStatus(id, 'escalated');
  }

  @Patch('conversations/:id/close')
  @Permissions('manage_whatsapp')
  @ApiOperation({ summary: 'Close conversation' })
  async close(@Param('id', ParseUUIDPipe) id: string) {
    return this.chatsService.setStatus(id, 'closed');
  }

  @Patch('conversations/:id/read')
  @Permissions('manage_whatsapp')
  @ApiOperation({ summary: 'Mark conversation as read' })
  async markAsRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.chatsService.markAsRead(id);
  }

  @Patch('conversations/:id')
  @Permissions('manage_whatsapp')
  @ApiOperation({ summary: 'Update conversation metadata and internal notes' })
  async updateMetadata(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateMetadataDto,
  ) {
    return this.chatsService.updateConversation(id, body);
  }

  @Sse('stream')
  @Permissions('manage_whatsapp')
  @ApiOperation({
    summary: 'Server-Sent Events for real-time WhatsApp chat updates',
  })
  stream(@CurrentUser() auth: AuthUser): Observable<{ data: string }> {
    // The connection stays open for hours, so the guard's check at connect
    // time is not enough: re-check before each event and hang up as soon as
    // this admin is deactivated or loses WhatsApp access.
    const stillAllowed = () =>
      refreshAdminAccess(this.dataSource, auth).then(
        () => adminCan(auth, 'manage_whatsapp'),
        () => false,
      );
    return this.eventsService.getStream().pipe(
      concatMap(async (event) => ((await stillAllowed()) ? event : null)),
      takeWhile((event) => event !== null),
      map((event) => ({
        data: JSON.stringify(event),
      })),
    );
  }
}

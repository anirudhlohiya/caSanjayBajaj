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
import { Observable, map } from 'rxjs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/roles.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';
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
  ) {}

  @Get('conversations')
  @Permissions('view_clients')
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

  @Get('usage')
  @Permissions('view_clients')
  @ApiOperation({ summary: 'Get monthly WhatsApp usage vs 1,000 free tier' })
  async getUsage() {
    return this.chatsService.getMonthlyUsageStats();
  }

  @Get('conversations/:id/messages')
  @Permissions('view_clients')
  @ApiOperation({ summary: 'Get messages for a conversation' })
  async getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.chatsService.getMessages(
      id,
      limit ? parseInt(limit, 10) : 50,
      before,
    );
  }

  @Post('conversations/:id/messages')
  @Permissions('view_clients')
  @ApiOperation({ summary: 'Staff sends a message via WhatsApp Cloud API' })
  async sendStaffMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendStaffMessageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.chatsService.sendStaffMessage(id, body.body, user.sub);
  }

  @Patch('conversations/:id/takeover')
  @Permissions('view_clients')
  @ApiOperation({ summary: 'Staff takes over the conversation' })
  async takeover(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.chatsService.takeover(id, user.sub);
  }

  @Patch('conversations/:id/release')
  @Permissions('view_clients')
  @ApiOperation({ summary: 'Hand back conversation to AI' })
  async release(@Param('id', ParseUUIDPipe) id: string) {
    return this.chatsService.release(id);
  }

  @Patch('conversations/:id/escalate')
  @Permissions('view_clients')
  @ApiOperation({ summary: 'Escalate conversation' })
  async escalate(@Param('id', ParseUUIDPipe) id: string) {
    return this.chatsService.setStatus(id, 'escalated');
  }

  @Patch('conversations/:id/close')
  @Permissions('view_clients')
  @ApiOperation({ summary: 'Close conversation' })
  async close(@Param('id', ParseUUIDPipe) id: string) {
    return this.chatsService.setStatus(id, 'closed');
  }

  @Patch('conversations/:id/read')
  @Permissions('view_clients')
  @ApiOperation({ summary: 'Mark conversation as read' })
  async markAsRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.chatsService.markAsRead(id);
  }

  @Patch('conversations/:id')
  @Permissions('view_clients')
  @ApiOperation({ summary: 'Update conversation metadata and internal notes' })
  async updateMetadata(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateMetadataDto,
  ) {
    return this.chatsService.updateConversation(id, body);
  }

  @Sse('stream')
  @Permissions('view_clients')
  @ApiOperation({
    summary: 'Server-Sent Events for real-time WhatsApp chat updates',
  })
  stream(): Observable<{ data: string }> {
    return this.eventsService.getStream().pipe(
      map((event) => ({
        data: JSON.stringify(event),
      })),
    );
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard, RolesGuard } from '../common/guards/roles.guard';
import {
  CreateFamilyMemberDto,
  UpdateFamilyMemberDto,
} from './dto/family-member.dto';
import { FamilyMembersService } from './family-members.service';

@ApiTags('family members (client)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/family-members')
export class MyFamilyMembersController {
  constructor(private readonly members: FamilyMembersService) {}

  @Get()
  @ApiOperation({ summary: 'List my family members' })
  list(@CurrentUser() auth: AuthUser) {
    return this.members.list(auth.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Add a family member (max 5)' })
  create(@CurrentUser() auth: AuthUser, @Body() dto: CreateFamilyMemberDto) {
    return this.members.create(auth.sub, dto);
  }

  @Patch(':memberId')
  @ApiOperation({ summary: 'Edit a family member' })
  update(
    @CurrentUser() auth: AuthUser,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateFamilyMemberDto,
  ) {
    return this.members.update(auth.sub, memberId, dto);
  }

  @Delete(':memberId')
  @ApiOperation({
    summary: 'Remove a family member and their ITR returns / documents',
  })
  async remove(
    @CurrentUser() auth: AuthUser,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    await this.members.remove(auth.sub, memberId);
    return { success: true };
  }
}

@ApiTags('family members (admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('admin/clients/:id/family-members')
export class AdminFamilyMembersController {
  constructor(private readonly members: FamilyMembersService) {}

  @Get()
  @Permissions('view_clients')
  @ApiOperation({ summary: "List a client's family members" })
  list(@Param('id', ParseUUIDPipe) clientId: string) {
    return this.members.list(clientId);
  }

  @Post()
  @Permissions('view_clients')
  @ApiOperation({ summary: 'Add a family member to a client (max 5)' })
  create(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Body() dto: CreateFamilyMemberDto,
  ) {
    return this.members.create(clientId, dto);
  }

  @Patch(':memberId')
  @Permissions('view_clients')
  @ApiOperation({ summary: "Edit a client's family member" })
  update(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateFamilyMemberDto,
  ) {
    return this.members.update(clientId, memberId, dto);
  }

  @Delete(':memberId')
  @Permissions('view_clients')
  @ApiOperation({ summary: "Remove a client's family member" })
  async remove(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    await this.members.remove(clientId, memberId);
    return { success: true };
  }
}

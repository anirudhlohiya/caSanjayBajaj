import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/permissions.decorator';
import { AdminRole } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminManagementService } from './admin-management.service';
import {
  CreateAdminDto,
  SetPermissionsDto,
  UpdateAdminDto,
} from './dto/admin.dto';

@ApiTags('staff & permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN)
@Controller('admin/staff')
export class AdminManagementController {
  constructor(private readonly adminManagement: AdminManagementService) {}

  @Get()
  @ApiOperation({ summary: 'List staff (super admin)' })
  list() {
    return this.adminManagement.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create staff account (super admin)' })
  create(@CurrentUser() auth: AuthUser, @Body() dto: CreateAdminDto) {
    return this.adminManagement.create(auth.sub, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a staff account' })
  get(@Param('id') id: string) {
    return this.adminManagement.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a staff account' })
  update(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdminDto,
  ) {
    return this.adminManagement.update(auth.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a staff account' })
  async deactivate(@CurrentUser() auth: AuthUser, @Param('id') id: string) {
    await this.adminManagement.deactivate(auth.sub, id);
    return { success: true };
  }

  @Get(':id/permissions')
  @ApiOperation({ summary: 'Get a staff permission flags' })
  getPermissions(@Param('id') id: string) {
    return this.adminManagement.getPermissions(id);
  }

  @Put(':id/permissions')
  @ApiOperation({ summary: 'Set a staff permission flags (replace set)' })
  setPermissions(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Body() dto: SetPermissionsDto,
  ) {
    return this.adminManagement.setPermissions(auth.sub, id, dto);
  }
}

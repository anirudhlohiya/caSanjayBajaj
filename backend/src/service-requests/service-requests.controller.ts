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
import { ServiceRequestStatus } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard, RolesGuard } from '../common/guards/roles.guard';
import {
  ChangeClientTypeDto,
  CreateServiceRequestDto,
  ReviewServiceRequestDto,
} from './dto/service-request.dto';
import { ServiceRequestsService } from './service-requests.service';

@ApiTags('service-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ServiceRequestsController {
  constructor(
    private readonly serviceRequestsService: ServiceRequestsService,
  ) {}

  @Post('me/service-requests')
  @ApiOperation({ summary: 'Submit a new service upgrade request (client)' })
  createMine(
    @CurrentUser() auth: AuthUser,
    @Body() dto: CreateServiceRequestDto,
  ) {
    return this.serviceRequestsService.create(auth.sub, dto);
  }

  @Get('me/service-requests')
  @ApiOperation({ summary: 'Get own service requests (client)' })
  listMine(@CurrentUser() auth: AuthUser) {
    return this.serviceRequestsService.listMine(auth.sub);
  }

  @Get('admin/service-requests')
  @Permissions('view_clients')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @ApiOperation({ summary: 'List service requests (admin)' })
  adminList(@Query('status') status?: ServiceRequestStatus) {
    return this.serviceRequestsService.adminList(status);
  }

  @Patch('admin/service-requests/:id')
  @Permissions('view_clients')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Approve or reject a service request (admin)' })
  review(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewServiceRequestDto,
  ) {
    return this.serviceRequestsService.review(auth.sub, id, dto);
  }

  @Patch(['admin/clients/:id/type', 'admin/users/:id/type'])
  @Permissions('view_clients')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @ApiOperation({ summary: 'Directly change client type (admin)' })
  changeType(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Body() dto: ChangeClientTypeDto,
  ) {
    return this.serviceRequestsService.changeClientType(auth.sub, id, dto);
  }
}

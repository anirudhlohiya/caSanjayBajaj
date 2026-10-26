import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard, RolesGuard } from '../common/guards/roles.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ServicesOfferedService } from './services-offered.service';
import {
  CreateServiceDto,
  ReorderServicesDto,
  ServiceContactDto,
  ServiceEnquiryDto,
  UpdateServiceDto,
} from './dto/service.dto';

@ApiTags('firm')
@Controller('firm')
export class FirmController {
  constructor(private readonly servicesService: ServicesOfferedService) {}

  @Get('contact')
  @ApiOperation({
    summary: 'Firm contact details and office hours (public)',
  })
  contact() {
    return this.servicesService.getContact();
  }
}

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesOfferedService) {}

  @Get()
  @ApiOperation({ summary: 'List active services (public)' })
  listActive() {
    return this.servicesService.listActive();
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Service detail page with contact numbers (public)',
  })
  get(@Param('slug') slug: string) {
    return this.servicesService.findPublic(slug);
  }

  @Post(':slug/enquiry')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Request a service — opens a support ticket for the client',
  })
  enquire(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ServiceEnquiryDto,
  ) {
    return this.servicesService.createEnquiry(slug, user.sub, dto.message);
  }
}

@ApiTags('services (admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('admin/services')
export class AdminServicesController {
  constructor(private readonly servicesService: ServicesOfferedService) {}

  @Get()
  @Permissions('manage_website')
  @ApiOperation({ summary: 'List all services' })
  listAll() {
    return this.servicesService.listAll();
  }

  @Get('settings/contact')
  @Permissions('manage_website')
  @ApiOperation({ summary: 'Firm-wide Call / WhatsApp numbers' })
  getContact() {
    return this.servicesService.getContact();
  }

  @Put('settings/contact')
  @Permissions('manage_website')
  @ApiOperation({ summary: 'Update firm-wide Call / WhatsApp numbers' })
  setContact(@Body() dto: ServiceContactDto) {
    return this.servicesService.setContact(dto);
  }

  @Post('reorder')
  @Permissions('manage_website')
  @ApiOperation({ summary: 'Set display order from a list of ids' })
  reorder(@Body() dto: ReorderServicesDto) {
    return this.servicesService.reorder(dto.ids);
  }

  @Get(':id')
  @Permissions('manage_website')
  @ApiOperation({ summary: 'Get a service' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.findOne(id);
  }

  @Post()
  @Permissions('manage_website')
  @ApiOperation({ summary: 'Create a service' })
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Patch(':id')
  @Permissions('manage_website')
  @ApiOperation({ summary: 'Update a service' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('manage_website')
  @ApiOperation({ summary: 'Deactivate a service' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.servicesService.remove(id);
    return { success: true };
  }
}

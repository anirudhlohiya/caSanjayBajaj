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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard, RolesGuard } from '../common/guards/roles.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ServicesOfferedService } from './services-offered.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesOfferedService) {}

  @Get()
  @ApiOperation({ summary: 'List active services (public)' })
  listActive() {
    return this.servicesService.listActive();
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

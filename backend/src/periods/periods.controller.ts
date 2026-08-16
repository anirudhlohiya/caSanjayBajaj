import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard, RolesGuard } from '../common/guards/roles.guard';
import { CreatePeriodDto, UpdatePeriodDto } from './dto/period.dto';
import { PeriodsService } from './periods.service';

@ApiTags('filing periods')
@ApiBearerAuth()
@Controller('periods')
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List all filing periods (authenticated)' })
  list() {
    return this.periodsService.list();
  }

  @Get('open')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List open filing periods (available for upload)' })
  listOpen() {
    return this.periodsService.listOpen();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('manage_settings')
  @ApiOperation({ summary: 'Create a filing period (admin)' })
  create(@Body() dto: CreatePeriodDto) {
    return this.periodsService.create(dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a filing period' })
  get(@Param('id') id: string) {
    return this.periodsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('manage_settings')
  @ApiOperation({ summary: 'Update a filing period (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdatePeriodDto) {
    return this.periodsService.update(id, dto);
  }
}

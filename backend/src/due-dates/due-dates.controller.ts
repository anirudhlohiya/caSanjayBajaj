import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard, RolesGuard } from '../common/guards/roles.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { DueDatesService } from './due-dates.service';
import {
  CreateDueDateDto,
  DueDateQueryDto,
  UpdateDueDateDto,
} from './dto/due-date.dto';

@ApiTags('due dates')
@Controller('due-dates')
export class DueDatesController {
  constructor(private readonly dueDates: DueDatesService) {}

  @Get()
  @ApiOperation({ summary: 'Due date calendar for a financial year (public)' })
  list(@Query() query: DueDateQueryDto) {
    return this.dueDates.listActive(query.fy);
  }
}

@ApiTags('due dates (admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('admin/due-dates')
export class AdminDueDatesController {
  constructor(private readonly dueDates: DueDatesService) {}

  @Get()
  @Permissions('manage_website')
  @ApiOperation({ summary: 'All due dates of a financial year' })
  list(@Query() query: DueDateQueryDto) {
    return this.dueDates.listAll(query.fy);
  }

  @Get('years')
  @Permissions('manage_website')
  @ApiOperation({ summary: 'Financial years that have due dates' })
  years() {
    return this.dueDates.years();
  }

  @Post()
  @Permissions('manage_website')
  @ApiOperation({ summary: 'Add a due date' })
  create(@Body() dto: CreateDueDateDto) {
    return this.dueDates.create(dto);
  }

  @Patch(':id')
  @Permissions('manage_website')
  @ApiOperation({ summary: 'Edit or extend a due date' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDueDateDto,
  ) {
    return this.dueDates.update(id, dto);
  }

  @Delete(':id')
  @Permissions('manage_website')
  @ApiOperation({ summary: 'Delete a due date' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.dueDates.remove(id);
    return { success: true };
  }
}

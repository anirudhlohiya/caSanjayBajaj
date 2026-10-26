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
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard, RolesGuard } from '../common/guards/roles.guard';
import { CreateFaqDto, ReorderFaqsDto, UpdateFaqDto } from './dto/faq.dto';
import { FaqsService } from './faqs.service';

@ApiTags('faqs')
@Controller('faqs')
export class FaqsController {
  constructor(private readonly faqs: FaqsService) {}

  @Get()
  @ApiOperation({ summary: 'FAQ page content (public)' })
  list() {
    return this.faqs.listActive();
  }
}

@ApiTags('faqs (admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('admin/faqs')
export class AdminFaqsController {
  constructor(private readonly faqs: FaqsService) {}

  @Get()
  @Permissions('manage_website')
  @ApiOperation({ summary: 'All FAQs, including hidden ones' })
  list() {
    return this.faqs.listAll();
  }

  @Post()
  @Permissions('manage_website')
  @ApiOperation({ summary: 'Add an FAQ' })
  create(@Body() dto: CreateFaqDto) {
    return this.faqs.create(dto);
  }

  @Post('reorder')
  @Permissions('manage_website')
  @ApiOperation({ summary: 'Set FAQ order from a list of ids' })
  reorder(@Body() dto: ReorderFaqsDto) {
    return this.faqs.reorder(dto.ids);
  }

  @Patch(':id')
  @Permissions('manage_website')
  @ApiOperation({ summary: 'Edit, hide or show an FAQ' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFaqDto) {
    return this.faqs.update(id, dto);
  }

  @Delete(':id')
  @Permissions('manage_website')
  @ApiOperation({ summary: 'Delete an FAQ' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.faqs.remove(id);
    return { success: true };
  }
}

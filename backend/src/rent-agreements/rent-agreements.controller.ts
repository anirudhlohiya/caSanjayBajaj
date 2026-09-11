import { Body, Controller, Get, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { RentAgreementsService } from './rent-agreements.service';
import { CreateRentAgreementDto, UpdateRentAgreementDto } from './dto/rent-agreement.dto';
import { TEMPLATES } from './templates/config';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/roles.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('view_clients')
@Controller('admin/rent-agreements')
export class RentAgreementsController {
  constructor(private readonly rentAgreementsService: RentAgreementsService) {}

  @Get('templates')
  getTemplates() {
    return { data: TEMPLATES };
  }

  @Get()
  async findAll(@Query('page') page = 1, @Query('limit') limit = 10, @Query('template_id') template_id?: string) {
    return this.rentAgreementsService.findAll(+page, +limit, template_id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { data: await this.rentAgreementsService.findOne(id) };
  }

  @Post()
  async create(@Body() createDto: CreateRentAgreementDto, @CurrentUser() auth: AuthUser) {
    return { data: await this.rentAgreementsService.create(createDto, auth?.sub ?? null) };
  }

  @Post('preview')
  async preview(@Body() createDto: CreateRentAgreementDto) {
    return { data: await this.rentAgreementsService.previewDocx(createDto) };
  }

  @Post('convert-to-docx')
  async convertToDocx(@Body('html') html: string, @Res() res: Response) {
    try {
      const buffer = await this.rentAgreementsService.docxFromHtml(html || '');
      res.setHeader('Content-Disposition', `attachment; filename=Edited_Agreement.docx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ message: 'Failed to convert document', error: error.message });
    }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateDto: UpdateRentAgreementDto) {
    return { data: await this.rentAgreementsService.update(id, updateDto) };
  }

  @Get(':id/download/docx')
  async downloadDocx(@Param('id') id: string, @Res() res: Response) {
    try {
      const edited = await this.rentAgreementsService.getEditedDocx(id);
      const filename = edited ? 'Agreement_Edited.docx' : 'Agreement.docx';

      if (edited) {
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(edited);
        return;
      }

      const buffer = await this.rentAgreementsService.generateDocx(id);
      const agreement = await this.rentAgreementsService.findOne(id);
      const filename2 = `Rent_Agreement_${agreement.tenant_name || 'Document'}.docx`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      
      res.setHeader('Content-Disposition', `attachment; filename=${filename2}`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ message: 'Failed to generate document', error: error.message });
    }
  }

  @Get(':id/office/config')
  async officeConfig(@Param('id') id: string) {
    const result = await this.rentAgreementsService.getOfficeEditorConfig(id);
    return { data: result };
  }
}

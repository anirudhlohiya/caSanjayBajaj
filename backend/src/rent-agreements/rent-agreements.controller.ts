import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { RentAgreementsService } from './rent-agreements.service';
import {
  CreateRentAgreementDto,
  UpdateRentAgreementDto,
} from './dto/rent-agreement.dto';
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

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  @Get('templates')
  getTemplates() {
    return { data: TEMPLATES };
  }

  @Get()
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('template_id') template_id?: string,
  ) {
    return this.rentAgreementsService.findAll(+page, +limit, template_id);
  }

  @Get('summary')
  async summary() {
    return { data: await this.rentAgreementsService.summary() };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { data: await this.rentAgreementsService.findOne(id) };
  }

  @Post()
  async create(
    @Body() createDto: CreateRentAgreementDto,
    @CurrentUser() auth: AuthUser,
  ) {
    return {
      data: await this.rentAgreementsService.create(
        createDto,
        auth?.sub ?? null,
      ),
    };
  }

  @Post('preview')
  preview(@Body() createDto: CreateRentAgreementDto) {
    return { data: this.rentAgreementsService.previewDocx(createDto) };
  }

  @Post('preview-pdf')
  async previewPdf(
    @Body() createDto: CreateRentAgreementDto,
    @Res() res: Response,
  ) {
    try {
      if (!this.rentAgreementsService.libreOfficeEnabled) {
        res
          .status(503)
          .json({ message: 'PDF preview requires LibreOffice on the server' });
        return;
      }
      const buffer = await this.rentAgreementsService.previewPdf(createDto);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename=Agreement_Preview.pdf',
      );
      res.send(buffer);
    } catch (error) {
      res.status(500).json({
        message: 'Failed to generate PDF preview',
        error: this.errorMessage(error),
      });
    }
  }

  @Post('convert-to-docx')
  async convertToDocx(@Body('html') html: string, @Res() res: Response) {
    try {
      const buffer = await this.rentAgreementsService.docxFromHtml(html || '');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=Edited_Agreement.docx`,
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      res.send(buffer);
    } catch (error) {
      res.status(500).json({
        message: 'Failed to convert document',
        error: this.errorMessage(error),
      });
    }
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateRentAgreementDto,
  ) {
    return { data: await this.rentAgreementsService.update(id, updateDto) };
  }

  @Get(':id/download/docx')
  async downloadDocx(@Param('id') id: string, @Res() res: Response) {
    try {
      const edited = await this.rentAgreementsService.getEditedDocx(id);
      const filename = edited ? 'Agreement_Edited.docx' : 'Agreement.docx';

      if (edited) {
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=${filename}`,
        );
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );
        res.send(edited);
        return;
      }

      const buffer = await this.rentAgreementsService.generateDocx(id);
      const agreement = await this.rentAgreementsService.findOne(id);
      const filename2 =
        `Rent_Agreement_${agreement.tenant_name || 'Document'}.docx`.replace(
          /[^a-zA-Z0-9_\-.]/g,
          '_',
        );

      res.setHeader('Content-Disposition', `attachment; filename=${filename2}`);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      res.send(buffer);
    } catch (error) {
      res.status(500).json({
        message: 'Failed to generate document',
        error: this.errorMessage(error),
      });
    }
  }

  @Get(':id/office/config')
  async officeConfig(@Param('id') id: string) {
    const result = await this.rentAgreementsService.getOfficeEditorConfig(id);
    return { data: result };
  }

  @Get(':id/preview/pdf')
  async previewAgreementPdf(@Param('id') id: string, @Res() res: Response) {
    try {
      if (!this.rentAgreementsService.libreOfficeEnabled) {
        res
          .status(503)
          .json({ message: 'PDF preview requires LibreOffice on the server' });
        return;
      }
      const buffer =
        await this.rentAgreementsService.previewPdfForAgreement(id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename=Agreement_Preview.pdf',
      );
      res.send(buffer);
    } catch (error) {
      res.status(500).json({
        message: 'Failed to generate PDF preview',
        error: this.errorMessage(error),
      });
    }
  }

  @Delete(':id')
  async softDelete(@Param('id') id: string) {
    return {
      data: { deleted: await this.rentAgreementsService.softDelete(id) },
    };
  }
}

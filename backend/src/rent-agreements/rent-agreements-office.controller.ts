import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RentAgreementsService } from './rent-agreements.service';

@Controller('admin/rent-agreements')
export class RentAgreementsOfficeController {
  constructor(private readonly rentAgreementsService: RentAgreementsService) {}

  @Get('office/source/:key')
  async officeSource(@Param('key') key: string, @Res() res: Response) {
    const source = await this.rentAgreementsService.getOfficeSourceBuf(key);
    if (!source) {
      res
        .status(404)
        .json({ error: 1, message: 'Source not found or expired' });
      return;
    }
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader('Content-Disposition', `inline; filename="${source.title}"`);
    res.send(source.buffer);
  }

  @Post('office/callback/:key')
  async officeCallback(@Param('key') key: string, @Body() body: any) {
    return this.rentAgreementsService.handleOfficeCallback(key, body);
  }
}

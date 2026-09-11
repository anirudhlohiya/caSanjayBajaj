import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { RentAgreement, RentAgreementStatus } from '../entities/rent-agreement.entity';
import { CreateRentAgreementDto, UpdateRentAgreementDto } from './dto/rent-agreement.dto';
import { StorageService } from '../storage/storage.service';
import { TEMPLATES } from './templates/config';
import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import HTMLtoDOCX from 'html-to-docx';
import { docxToHtml } from './docx-to-html';

function calculateAge(dobStr: string): string {
  if (!dobStr) return '';
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return '';
  const diffMs = Date.now() - dob.getTime();
  const ageDt = new Date(diffMs); 
  return Math.abs(ageDt.getUTCFullYear() - 1970).toString();
}

function numberToWordsIndian(num: number | string): string {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (!num) return '';
  let n = parseInt(String(num), 10);
  if (n === 0) return 'Zero';
  
  const numToWords = (n: number, suffix: string): string => {
    let str = '';
    if (n > 19) {
      str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
    } else {
      str += a[n];
    }
    return str ? str + suffix : '';
  };
  
  let res = '';
  res += numToWords(Math.floor(n / 10000000), 'Crore ');
  res += numToWords(Math.floor((n / 100000) % 100), 'Lakh ');
  res += numToWords(Math.floor((n / 1000) % 100), 'Thousand ');
  res += numToWords(Math.floor((n / 100) % 10), 'Hundred ');
  
  if (n > 100 && n % 100 > 0) {
    res += 'and ';
  }
  res += numToWords(n % 100, '');
  
  return 'Rupees ' + res.trim() + ' Only';
}

function extractSummary(formData: Record<string, any>) {
  return {
    owner_name:
      formData?.owner_name ||
      formData?.licensor_name ||
      (Array.isArray(formData?.licensors) ? formData.licensors[0]?.name ?? null : null),
    tenant_name:
      formData?.tenant_name ||
      formData?.licensee_name ||
      (Array.isArray(formData?.licensees) ? formData.licensees[0]?.name ?? null : null),
    property_address: formData?.property_address ?? formData?.PROPERTY_ADDRESS ?? null,
    agreement_start_date: formData?.agreement_start_date ?? formData?.['starting date'] ?? null,
    agreement_end_date: formData?.agreement_end_date ?? formData?.['ending date'] ?? null,
  };
}

@Injectable()
export class RentAgreementsService {
  private readonly logger = new Logger(RentAgreementsService.name);
  private readonly officeSessions = new Map<
    string,
    { agreementId: string; buffer: Buffer; expiresAt: number }
  >();

  constructor(
    @InjectRepository(RentAgreement)
    private readonly rentAgreementRepository: Repository<RentAgreement>,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {}

  async findAll(page: number, limit: number, template_id?: string) {
    const query = this.rentAgreementRepository.createQueryBuilder('agreement')
      .leftJoinAndSelect('agreement.created_by_admin', 'admin')
      .orderBy('agreement.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (template_id) {
      query.andWhere('agreement.template_id = :template_id', { template_id });
    }

    const [items, total] = await query.getManyAndCount();
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const agreement = await this.rentAgreementRepository.findOne({ where: { id }, relations: { created_by_admin: true } });
    if (!agreement) throw new NotFoundException('Agreement not found');
    return agreement;
  }

  async create(createDto: CreateRentAgreementDto, adminId: string) {
    const templateConfig = TEMPLATES.find(t => t.id === createDto.template_id);
    if (!templateConfig) throw new NotFoundException('Template not found');

    const summary = extractSummary(createDto.form_data || {});

    const agreement = this.rentAgreementRepository.create({
      template_id: createDto.template_id,
      form_data: createDto.form_data || {},
      status: createDto.status || RentAgreementStatus.DRAFT,
      created_by_admin_id: adminId,
      owner_name: summary.owner_name,
      tenant_name: summary.tenant_name,
      property_address: summary.property_address,
      agreement_start_date: summary.agreement_start_date,
      agreement_end_date: summary.agreement_end_date,
    });
    return this.rentAgreementRepository.save(agreement);
  }

  async update(id: string, updateDto: UpdateRentAgreementDto) {
    const agreement = await this.findOne(id);

    if (updateDto.form_data) {
      agreement.form_data = { ...agreement.form_data, ...updateDto.form_data };
      const summary = extractSummary(agreement.form_data);
      agreement.owner_name = summary.owner_name;
      agreement.tenant_name = summary.tenant_name;
      agreement.property_address = summary.property_address;
      agreement.agreement_start_date = summary.agreement_start_date;
      agreement.agreement_end_date = summary.agreement_end_date;
    }
    
    if (updateDto.status) {
      agreement.status = updateDto.status;
    }

    return this.rentAgreementRepository.save(agreement);
  }

  async generateDocx(id: string): Promise<Buffer> {
    const agreement = await this.findOne(id);
    return this.generateDocxBuffer(agreement.template_id, agreement.form_data);
  }

  async previewDocx(createDto: CreateRentAgreementDto): Promise<string> {
    const buffer = await this.generateDocxBuffer(createDto.template_id, createDto.form_data);
    const zip = new PizZip(buffer);
    const xml = zip.files['word/document.xml'].asText();
    return docxToHtml(xml);
  }

  async docxFromHtml(html: string): Promise<Buffer> {
    const buffer = await HTMLtoDOCX(html, null, {
      font: 'Times New Roman',
      fontSize: '22',
      margin: { top: 720, right: 720, bottom: 720, left: 720 },
    });
    return Buffer.from(buffer);
  }

  get officeEnabled(): boolean {
    return this.config.get<boolean>('onlyOffice.enabled') === true;
  }

  get officeServerUrl(): string {
    return this.config.get<string>('onlyOffice.serverUrl') ?? '';
  }

  async getOfficeEditorConfig(id: string) {
    if (!this.officeEnabled) {
      throw new NotFoundException('OnlyOffice integration is not enabled');
    }
    const agreement = await this.findOne(id);
    const buffer = await this.generateDocxBuffer(agreement.template_id, agreement.form_data);

    const key = randomUUID();
    this.officeSessions.set(key, {
      agreementId: id,
      buffer,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    });

    let apiBase = String(this.config.get<string>('onlyOffice.apiBaseUrl') ?? '').replace(/\/+$/, '');
    if (apiBase.endsWith('/api/v1') || apiBase.endsWith('/api/v1/')) {
      apiBase = apiBase.replace(/\/api\/v1\/?$/, '');
    }
    const sourceUrl = `${apiBase}/api/v1/admin/rent-agreements/office/source/${key}`;
    const callbackUrl = `${apiBase}/api/v1/admin/rent-agreements/office/callback/${key}`;
    const title = agreement.tenant_name ? `Rent_Agreement_${agreement.tenant_name}.docx` : 'Rent_Agreement.docx';

    const config: any = {
      documentType: 'word',
      document: {
        fileType: 'docx',
        key,
        title,
        url: sourceUrl,
        permissions: { edit: true, download: true, print: true },
      },
      editorConfig: {
        mode: 'edit',
        lang: 'en',
        callbackUrl,
        user: { id: 'admin', name: 'Admin' },
        customization: { autosave: false },
      },
      height: '100%',
      width: '100%',
    };

    const jwtSecret = this.config.get<string>('onlyOffice.jwtSecret') ?? '';
    if (jwtSecret) {
      config.token = jwt.sign(config, jwtSecret, {
        expiresIn: '2h',
        algorithm: 'HS256',
      });
    }

    return { serverUrl: this.officeServerUrl, config };
  }

  async getOfficeSourceBuf(key: string): Promise<{ buffer: Buffer; title: string } | null> {
    const session = this.officeSessions.get(key);
    if (!session || Date.now() > session.expiresAt) {
      this.officeSessions.delete(key);
      return null;
    }
    const agreement = await this.findOne(session.agreementId).catch(() => null);
    return {
      buffer: session.buffer,
      title: agreement?.tenant_name ? `Rent_Agreement_${agreement.tenant_name}.docx` : 'Rent_Agreement.docx',
    };
  }

  async handleOfficeCallback(key: string, body: any) {
    const session = this.officeSessions.get(key);
    if (!session) {
      return { error: 0 };
    }
    const status = body?.status;
    if ((status === 2 || status === 6) && body?.url) {
      try {
        const res = await fetch(body.url);
        if (!res.ok) throw new Error(`OnlyOffice file download failed: ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        const s3Key = `rent-agreements/${session.agreementId}/edited.docx`;
        await this.storage.uploadBuffer(
          s3Key,
          Buffer.from(arrayBuffer),
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );
        await this.rentAgreementRepository.update(session.agreementId, {
          edited_docx_s3_key: s3Key,
        });
        this.logger.log(`Edited agreement saved for ${session.agreementId}`);
      } catch (error) {
        this.logger.error(`OnlyOffice callback save failed: ${(error as Error).message}`);
        return { error: 1 };
      }
    }
    return { error: 0 };
  }

  async getEditedDocx(id: string): Promise<Buffer | null> {
    const agreement = await this.findOne(id);
    if (!agreement.edited_docx_s3_key) return null;
    return this.storage.downloadBuffer(agreement.edited_docx_s3_key);
  }

  private async generateDocxBuffer(template_id: string, form_data: any): Promise<Buffer> {
    const templateConfig = TEMPLATES.find(t => t.id === template_id);
    if (!templateConfig) throw new NotFoundException('Template configuration not found');

    const templatePath = path.resolve(process.cwd(), '..', 'docs', 'templates', templateConfig.templateFileName);
    
    if (!fs.existsSync(templatePath)) {
      throw new NotFoundException(`Template file not found at ${templatePath}`);
    }

    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });

    const data = { ...form_data };
    
    // Process licensors array
    if (Array.isArray(data.licensors)) {
      data.licensors = data.licensors.map((person: any) => ({
        ...person,
        abbreviation: person.gender === 'Female' ? 'Mrs.' : 'Mr.',
        age: calculateAge(person.dob),
        NAME: person.name,
      }));
    }

    // Process licensees array
    if (Array.isArray(data.licensees)) {
      data.licensees = data.licensees.map((person: any) => ({
        ...person,
        abbreviation: person.gender === 'Female' ? 'Mrs.' : 'Mr.',
        age: calculateAge(person.dob),
        NAME: person.name,
      }));
    }

    // Process rent and deposit words
    if (data['rent in numbers']) {
      data['rent in words'] = numberToWordsIndian(data['rent in numbers']);
    }
    
    if (data['deposit in numbers']) {
      data['deposit in words'] = numberToWordsIndian(data['deposit in numbers']);
    }

    doc.render(data);
    return doc.getZip().generate({ type: 'nodebuffer' });
  }
}

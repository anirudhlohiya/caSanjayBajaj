import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import {
  RentAgreement,
  RentAgreementStatus,
} from '../entities/rent-agreement.entity';
import {
  CreateRentAgreementDto,
  UpdateRentAgreementDto,
} from './dto/rent-agreement.dto';
import { StorageService } from '../storage/storage.service';
import { LibreOfficeService } from './libreoffice.service';
import { TEMPLATES } from './templates/config';
import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
// html-to-docx ships no type declarations alongside its UMD build.
import HTMLtoDOCXRaw from 'html-to-docx';
import { docxToHtml } from './docx-to-html';
import { sanitizeDocumentXml } from './docx-repair';

type HtmlToDocxFn = (
  html: string,
  header?: unknown,
  options?: Record<string, unknown>,
) => Promise<Buffer>;

const HTMLtoDOCX = HTMLtoDOCXRaw as unknown as HtmlToDocxFn;

function calculateAge(dobStr: string): string {
  if (!dobStr) return '';
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return '';
  const diffMs = Date.now() - dob.getTime();
  const ageDt = new Date(diffMs);
  return Math.abs(ageDt.getUTCFullYear() - 1970).toString();
}

function numberToWordsIndian(num: number | string): string {
  const a = [
    '',
    'One ',
    'Two ',
    'Three ',
    'Four ',
    'Five ',
    'Six ',
    'Seven ',
    'Eight ',
    'Nine ',
    'Ten ',
    'Eleven ',
    'Twelve ',
    'Thirteen ',
    'Fourteen ',
    'Fifteen ',
    'Sixteen ',
    'Seventeen ',
    'Eighteen ',
    'Nineteen ',
  ];
  const b = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  if (!num) return '';
  const n = parseInt(String(num), 10);
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

function firstPresent(...values: unknown[]): string | null {
  for (const v of values) {
    if (v !== null && v !== undefined) {
      if (typeof v === 'string' && v.trim()) return v;
      if (typeof v === 'number' && !Number.isNaN(v)) return String(v);
      return null;
    }
  }
  return null;
}

function extractSummary(formData: Record<string, unknown>): {
  owner_name: string | null;
  tenant_name: string | null;
  property_address: string | null;
  agreement_start_date: string | null;
  agreement_end_date: string | null;
} {
  const first = (...keys: string[]): unknown => {
    for (const key of keys) {
      const value = formData[key];
      if (value !== null && value !== undefined) return value;
    }
    return null;
  };

  const listItem = (key: string): unknown => {
    const value = formData[key];
    return Array.isArray(value) ? value[0] : null;
  };

  const nameOf = (value: unknown): unknown => {
    if (value && typeof value === 'object' && 'name' in value) {
      return (value as { name?: unknown }).name;
    }
    return null;
  };

  return {
    owner_name: firstPresent(
      first('owner_name', 'licensor_name'),
      nameOf(listItem('licensors')),
    ),
    tenant_name: firstPresent(
      first('tenant_name', 'licensee_name'),
      nameOf(listItem('licensees')),
    ),
    property_address: firstPresent(
      first('property_address', 'PROPERTY_ADDRESS'),
    ),
    agreement_start_date: firstPresent(
      first('agreement_start_date', 'starting date'),
    ),
    agreement_end_date: firstPresent(
      first('agreement_end_date', 'ending date'),
    ),
  };
}

export interface OfficeEditorConfig {
  documentType: string;
  document: {
    fileType: string;
    key: string;
    title: string;
    url: string;
    permissions: { edit: boolean; download: boolean; print: boolean };
  };
  editorConfig: {
    mode: string;
    lang: string;
    callbackUrl: string;
    user: { id: string; name: string };
    customization: { autosave: boolean };
  };
  height: string;
  width: string;
  token?: string;
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
    private readonly libreOffice: LibreOfficeService,
  ) {}

  get libreOfficeEnabled(): boolean {
    return this.libreOffice.enabled;
  }

  async findAll(page: number, limit: number, template_id?: string) {
    const query = this.rentAgreementRepository
      .createQueryBuilder('agreement')
      .leftJoinAndSelect('agreement.created_by_admin', 'admin')
      .where('agreement.deleted_at IS NULL')
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
    const agreement = await this.rentAgreementRepository.findOne({
      where: { id },
      relations: { created_by_admin: true },
    });
    if (!agreement) throw new NotFoundException('Agreement not found');
    return agreement;
  }

  async summary(): Promise<{
    total: number;
    draft: number;
    generated: number;
  }> {
    const rows = await this.rentAgreementRepository
      .createQueryBuilder('agreement')
      .where('agreement.deleted_at IS NULL')
      .select('agreement.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('agreement.status')
      .getRawMany<{ status: string; count: string }>();

    let draft = 0;
    let generated = 0;
    for (const row of rows) {
      const count = parseInt(row.count, 10) || 0;
      const status = row.status as RentAgreementStatus;
      if (status === RentAgreementStatus.GENERATED) {
        generated = count;
      } else {
        draft = count;
      }
    }
    return { total: draft + generated, draft, generated };
  }

  async softDelete(id: string): Promise<boolean> {
    await this.findOne(id);
    await this.rentAgreementRepository.softDelete(id);
    return true;
  }

  async create(createDto: CreateRentAgreementDto, adminId: string) {
    const templateConfig = TEMPLATES.find(
      (t) => t.id === createDto.template_id,
    );
    if (!templateConfig) throw new NotFoundException('Template not found');

    const summary = extractSummary(
      (createDto.form_data ?? {}) as Record<string, unknown>,
    );

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
      agreement.form_data = {
        ...(agreement.form_data ?? {}),
        ...(updateDto.form_data ?? {}),
      } as Record<string, unknown>;
      const summary = extractSummary(
        (agreement.form_data ?? {}) as Record<string, unknown>,
      );
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
    return this.generateDocxBuffer(
      agreement.template_id,
      (agreement.form_data ?? {}) as Record<string, unknown>,
    );
  }

  previewDocx(createDto: CreateRentAgreementDto): string {
    const buffer = this.generateDocxBuffer(
      createDto.template_id,
      (createDto.form_data ?? {}) as Record<string, unknown>,
    );
    const zip = new PizZip(buffer);
    const xml = zip.files['word/document.xml'].asText();
    return docxToHtml(xml);
  }

  async previewPdf(createDto: CreateRentAgreementDto): Promise<Buffer> {
    const docx = this.generateDocxBuffer(
      createDto.template_id,
      (createDto.form_data ?? {}) as Record<string, unknown>,
    );
    return this.libreOffice.convertDocxToPdf(docx);
  }

  async previewPdfForAgreement(id: string): Promise<Buffer> {
    const agreement = await this.findOne(id);
    let source: Buffer | null = null;
    if (agreement.edited_docx_s3_key) {
      try {
        source = await this.storage.downloadBuffer(
          agreement.edited_docx_s3_key,
        );
      } catch {
        this.logger.warn(
          `Edited DOCX missing from S3 (${agreement.edited_docx_s3_key}); falling back to generated docx for ${id}`,
        );
      }
    }
    source ??= this.generateDocxBuffer(
      agreement.template_id,
      (agreement.form_data ?? {}) as Record<string, unknown>,
    );
    return this.libreOffice.convertDocxToPdf(source);
  }

  async docxFromHtml(html: string): Promise<Buffer> {
    const buffer = await HTMLtoDOCX(html, null, {
      font: 'Times New Roman',
      fontSize: '22',
      margin: { top: 720, right: 720, bottom: 720, left: 720 },
    });
    return this.sanitizeDocxBuffer(buffer);
  }

  private sanitizeDocxBuffer(buffer: Buffer): Buffer {
    try {
      const zip = new PizZip(buffer);
      const file = zip.files['word/document.xml'];
      if (!file) return buffer;

      const result = sanitizeDocumentXml(file.asText());
      if (result.error) {
        throw new Error(
          `Generated DOCX failed XML validation: ${result.error}`,
        );
      }
      if (result.changed.length) {
        this.logger.warn(`docx repair applied: ${result.changed.join('; ')}`);
      }
      const repaired = result.xml;
      if (repaired !== null) {
        zip.file('word/document.xml', repaired);
      }
      return zip.generate({ type: 'nodebuffer' });
    } catch (err) {
      this.logger.error(
        `docx sanitize failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return buffer;
    }
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
    const buffer = this.generateDocxBuffer(
      agreement.template_id,
      (agreement.form_data ?? {}) as Record<string, unknown>,
    );

    const key = randomUUID();
    this.officeSessions.set(key, {
      agreementId: id,
      buffer,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    });

    let apiBase = String(
      this.config.get<string>('onlyOffice.apiBaseUrl') ?? '',
    ).replace(/\/+$/, '');
    if (apiBase.endsWith('/api/v1') || apiBase.endsWith('/api/v1/')) {
      apiBase = apiBase.replace(/\/api\/v1\/?$/, '');
    }
    const sourceUrl = `${apiBase}/api/v1/admin/rent-agreements/office/source/${key}`;
    const callbackUrl = `${apiBase}/api/v1/admin/rent-agreements/office/callback/${key}`;
    const title = agreement.tenant_name
      ? `Rent_Agreement_${agreement.tenant_name}.docx`
      : 'Rent_Agreement.docx';

    const config: OfficeEditorConfig = {
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
      config.token = jwt.sign({ ...config }, jwtSecret, {
        expiresIn: '2h',
        algorithm: 'HS256',
      });
    }

    return { serverUrl: this.officeServerUrl, config };
  }

  async getOfficeSourceBuf(
    key: string,
  ): Promise<{ buffer: Buffer; title: string } | null> {
    const session = this.officeSessions.get(key);
    if (!session || Date.now() > session.expiresAt) {
      this.officeSessions.delete(key);
      return null;
    }
    const agreement = await this.findOne(session.agreementId).catch(() => null);
    return {
      buffer: session.buffer,
      title: agreement?.tenant_name
        ? `Rent_Agreement_${agreement.tenant_name}.docx`
        : 'Rent_Agreement.docx',
    };
  }

  async handleOfficeCallback(key: string, bodyValue: unknown) {
    const session = this.officeSessions.get(key);
    if (!session) {
      return { error: 0 };
    }
    const body = (bodyValue ?? {}) as Record<string, unknown>;
    const status = body['status'];
    const url = body['url'];
    if ((status === 2 || status === 6) && typeof url === 'string') {
      try {
        const res = await fetch(url);
        if (!res.ok)
          throw new Error(`OnlyOffice file download failed: ${res.status}`);
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
        this.logger.error(
          `OnlyOffice callback save failed: ${(error as Error).message}`,
        );
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

  private generateDocxBuffer(
    template_id: string,
    form_data: Record<string, unknown>,
  ): Buffer {
    const templateConfig = TEMPLATES.find((t) => t.id === template_id);
    if (!templateConfig)
      throw new NotFoundException('Template configuration not found');

    const templatePath = path.resolve(
      process.cwd(),
      '..',
      'docs',
      'templates',
      templateConfig.templateFileName,
    );

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

    const data: Record<string, unknown> = { ...form_data };

    if (Array.isArray(data['licensors'])) {
      const licensors = data['licensors'] as Array<Record<string, unknown>>;
      data['licensors'] = licensors.map((person) => ({
        ...person,
        abbreviation: person['gender'] === 'Female' ? 'Mrs.' : 'Mr.',
        age: calculateAge(
          typeof person['dob'] === 'string' ? person['dob'] : '',
        ),
        NAME: person['name'],
      }));
    }

    if (Array.isArray(data['licensees'])) {
      const licensees = data['licensees'] as Array<Record<string, unknown>>;
      data['licensees'] = licensees.map((person) => ({
        ...person,
        abbreviation: person['gender'] === 'Female' ? 'Mrs.' : 'Mr.',
        age: calculateAge(
          typeof person['dob'] === 'string' ? person['dob'] : '',
        ),
        NAME: person['name'],
      }));
    }

    const rentInNumbers = data['rent in numbers'];
    if (
      typeof rentInNumbers === 'string' ||
      typeof rentInNumbers === 'number'
    ) {
      data['rent in words'] = numberToWordsIndian(rentInNumbers);
    }

    const depositInNumbers = data['deposit in numbers'];
    if (
      typeof depositInNumbers === 'string' ||
      typeof depositInNumbers === 'number'
    ) {
      data['deposit in words'] = numberToWordsIndian(depositInNumbers);
    }

    doc.render(data);
    const rendered = doc.getZip().generate({ type: 'nodebuffer' });
    return this.sanitizeDocxBuffer(rendered);
  }
}
